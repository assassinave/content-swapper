// Content Swapper Plugin - Simplified Version
figma.showUI(__html__, { width: 420, height: 480 });

// Load saved datasets on plugin startup
setTimeout(() => {
  loadSavedDatasets();
}, 100);

const STORAGE_KEY = 'content-swapper-data';
const DATASETS_KEY = 'content-swapper-datasets';
const MAX_DATASETS = 5;

// ============================================================================
// STORAGE FUNCTIONS (Keep existing)
// ============================================================================

async function loadSavedData() {
  try {
    const savedData = await figma.clientStorage.getAsync(STORAGE_KEY);
    if (savedData) {
      figma.ui.postMessage({
        type: 'saved-data-loaded',
        data: savedData
      });
    }
  } catch (error) {
    console.log('Error loading saved data:', error);
  }
}

async function loadSavedDatasets() {
  try {
    const datasets = await figma.clientStorage.getAsync(DATASETS_KEY);
    figma.ui.postMessage({
      type: 'datasets-loaded',
      datasets: datasets || {}
    });
  } catch (error) {
    console.log('Error loading datasets:', error);
    figma.ui.postMessage({
      type: 'datasets-loaded',
      datasets: {}
    });
  }
}

async function saveDataset(name, data) {
  try {
    const datasets = await figma.clientStorage.getAsync(DATASETS_KEY) || {};
    
    if (Object.keys(datasets).length >= MAX_DATASETS && !datasets[name]) {
      figma.ui.postMessage({
        type: 'dataset-saved',
        success: false,
        message: `Maximum ${MAX_DATASETS} datasets allowed`
      });
      return;
    }
    
    datasets[name] = {
      data: data,
      created: new Date().toISOString()
    };
    
    await figma.clientStorage.setAsync(DATASETS_KEY, datasets);
    
    figma.ui.postMessage({
      type: 'dataset-saved',
      success: true,
      name: name,
      data: data
    });
    
    console.log(`Dataset "${name}" saved successfully`);
  } catch (error) {
    console.log('Error saving dataset:', error);
    figma.ui.postMessage({
      type: 'dataset-saved',
      success: false,
      message: error.message
    });
  }
}

async function deleteDataset(name) {
  try {
    const datasets = await figma.clientStorage.getAsync(DATASETS_KEY) || {};
    
    if (!datasets[name]) {
      figma.ui.postMessage({
        type: 'dataset-deleted',
        success: false,
        message: 'Dataset not found'
      });
      return;
    }
    
    delete datasets[name];
    await figma.clientStorage.setAsync(DATASETS_KEY, datasets);
    
    figma.ui.postMessage({
      type: 'dataset-deleted',
      success: true,
      name: name
    });
    
    console.log(`Dataset "${name}" deleted successfully`);
  } catch (error) {
    console.log('Error deleting dataset:', error);
    figma.ui.postMessage({
      type: 'dataset-deleted',
      success: false,
      message: error.message
    });
  }
}

async function saveData(data) {
  try {
    await figma.clientStorage.setAsync(STORAGE_KEY, data);
    console.log('Data saved successfully');
  } catch (error) {
    console.log('Error saving data:', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS (Keep existing)
// ============================================================================

function extractKeyFromLayerName(layerName) {
  const match = layerName.match(/^\{\{([^}]+)\}\}$/);
  return match ? match[1] : null;
}

function hasValidLayerFormat(layerName) {
  return /^\{\{[^}]+\}\}$/.test(layerName);
}

function flattenObject(obj, prefix = '', result = {}) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            flattenObject(item, `${newKey}[${index}]`, result);
          } else {
            result[`${newKey}[${index}]`] = item;
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        flattenObject(value, newKey, result);
      } else {
        result[newKey] = value;
      }
    }
  }
  return result;
}

function getValueByPath(obj, path) {
  const parts = path.split(/[\.\[\]]+/).filter(Boolean);
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return '';
    }
    
    if (/^\d+$/.test(part)) {
      const index = parseInt(part);
      if (Array.isArray(current) && index < current.length) {
        current = current[index];
      } else {
        return '';
      }
    } else {
      current = current[part];
    }
  }
  
  return current !== null && current !== undefined ? String(current) : '';
}

function isNodeVisible(node) {
  let currentNode = node;
  while (currentNode && currentNode.type !== 'PAGE') {
    if (!currentNode.visible) {
      return false;
    }
    currentNode = currentNode.parent;
  }
  return true;
}

function findAllTextNodes(node) {
  const textNodes = [];
  
  if (node.type === 'TEXT') {
    if (isNodeVisible(node)) {
      textNodes.push(node);
    }
  } else if ('children' in node) {
    for (const child of node.children) {
      textNodes.push(...findAllTextNodes(child));
    }
  }
  
  return textNodes;
}

// ============================================================================
// SIMPLIFIED INVENTORY-FIRST PROCESSING
// ============================================================================

function analyzeFieldInventory(textNodes) {
  const fieldCounts = new Map();
  const fieldNodes = new Map();
  
  // Count instances of each field type and track nodes
  textNodes.forEach(node => {
    if (!hasValidLayerFormat(node.name)) return;
    
    const fieldName = extractKeyFromLayerName(node.name);
    if (!fieldName) return;
    
    if (!fieldCounts.has(fieldName)) {
      fieldCounts.set(fieldName, 0);
      fieldNodes.set(fieldName, []);
    }
    
    fieldCounts.set(fieldName, fieldCounts.get(fieldName) + 1);
    fieldNodes.get(fieldName).push(node);
  });
  
  // Determine max instances (how many records we need)
  const maxInstances = Math.max(...Array.from(fieldCounts.values()), 1);
  
  console.log('Field Inventory Analysis:');
  Array.from(fieldCounts.entries()).forEach(([field, count]) => {
    console.log(`  ${field}: ${count} instances`);
  });
  console.log(`Max instances detected: ${maxInstances}`);
  
  return {
    fieldCounts,
    fieldNodes,
    maxInstances,
    totalFields: Array.from(fieldCounts.keys()).length
  };
}

function groupNodesByContainer(textNodes) {
  const groups = new Map();
  
  textNodes.forEach(node => {
    if (!hasValidLayerFormat(node.name)) return;
    
    // Find the most immediate container (parent frame/group)
    let container = node.parent;
    while (container && container.type === 'TEXT') {
      container = container.parent;
    }
    
    const containerId = container ? container.id : 'root';
    
    if (!groups.has(containerId)) {
      groups.set(containerId, {
        container: container,
        nodes: []
      });
    }
    
    groups.get(containerId).nodes.push(node);
  });
  
  console.log(`Grouped nodes into ${groups.size} containers`);
  
  return groups;
}

function detectDataStructure(inventory, data) {
  if (!data || data.length === 0) {
    return { type: 'no-data', recordCount: 0 };
  }
  
  const { maxInstances } = inventory;
  const dataRecordCount = data.length;
  
  console.log(`Structure detection: ${maxInstances} max instances, ${dataRecordCount} data records`);
  
  // If we have multiple instances and multiple data records, prefer different records
  // This handles cases like 2 instances with 3 data records - use different records
  if (maxInstances > 1 && dataRecordCount > 1) {
    return {
      type: 'multiple-records',
      recordCount: dataRecordCount,
      description: `${maxInstances} sets of fields → cycling through ${dataRecordCount} data records`
    };
  } else if (maxInstances > 1) {
    // Only use arrays if we have multiple instances but only one data record
    return {
      type: 'single-record-arrays',
      recordCount: 1,
      arrayLength: maxInstances,
      description: `${maxInstances} sets of fields → arrays in single record`
    };
  } else {
    return {
      type: 'single-record-single',
      recordCount: 1,
      description: 'Single set of fields → single record'
    };
  }
}

function assignDataToNodes(inventory, data, dataStructure) {
  const { fieldNodes } = inventory;
  const assignments = [];
  
  if (dataStructure.type === 'no-data') {
    return assignments;
  }
  
  // Get flattened paths from first record for field discovery
  const sampleData = data[0] || {};
  const flattenedSample = flattenObject(sampleData);
  const availablePaths = Object.keys(flattenedSample);
  
  console.log(`Data assignment strategy: ${dataStructure.description}`);
  
  for (const [fieldName, nodes] of fieldNodes.entries()) {
    // Find matching data paths
    const directPath = fieldName;
    const nestedPaths = availablePaths.filter(path => {
      const pathParts = path.split(/[\.\[\]]+/).filter(Boolean);
      return pathParts[pathParts.length - 1] === fieldName;
    });
    
    const matchingPaths = nestedPaths.length > 0 ? nestedPaths : 
                         availablePaths.includes(directPath) ? [directPath] : [];
    
    if (matchingPaths.length === 0) {
      console.log(`No data found for field: ${fieldName}`);
      continue;
    }
    
         // Assign data based on structure type
     nodes.forEach((node, nodeIndex) => {
       let dataPath, dataRecord, recordIndex;
       
       if (dataStructure.type === 'multiple-records') {
         // Each position gets a different record
         recordIndex = nodeIndex % data.length;
         dataRecord = data[recordIndex];
         dataPath = matchingPaths[0]; // Use first available path
         
         console.log(`${fieldName}[${nodeIndex}] → Record ${recordIndex} (${dataRecord.full_name || 'unnamed'}) via path: ${dataPath}`);
       } else if (dataStructure.type === 'single-record-arrays') {
         // Use arrays within single record
         recordIndex = 0;
         dataRecord = data[0];
         const arrayPaths = matchingPaths.filter(path => path.includes('['));
         if (arrayPaths.length > 0) {
           // Find path with correct index
           const targetPath = arrayPaths.find(path => path.includes(`[${nodeIndex}]`)) ||
                            arrayPaths[nodeIndex % arrayPaths.length];
           dataPath = targetPath;
         } else {
           dataPath = matchingPaths[0];
         }
         
         console.log(`${fieldName}[${nodeIndex}] → Record 0 via array path: ${dataPath}`);
       } else {
         // Single record, single value
         recordIndex = 0;
         dataRecord = data[0];
         dataPath = matchingPaths[0];
         
         console.log(`${fieldName}[${nodeIndex}] → Record 0 via path: ${dataPath}`);
       }
       
       const value = getValueByPath(dataRecord, dataPath);
       
       console.log(`  Extracted value: "${value}"`);
       
       assignments.push({
         node,
         value,
         dataPath,
         recordIndex: recordIndex
       });
     });
  }
  
  return assignments;
}

async function processContentSwapSimplified(data) {
  try {
    await saveData(data);
    
    const originalSelection = figma.currentPage.selection;
    
    if (originalSelection.length === 0) {
      figma.ui.postMessage({
        type: 'processing-complete',
        success: false,
        message: 'Please select some objects containing text first'
      });
      return;
    }

    // Check if this is a single record (Apply) or multiple records (Apply All)
    if (data.length === 1) {
      console.log('🎯 SINGLE RECORD MODE - Applying same record to each selection individually');
      
      // Even for single records, iterate through selections for consistency
      let totalProcessed = 0;
      let totalErrors = 0;
      const allMissingKeys = new Set();
      
      for (let i = 0; i < originalSelection.length; i++) {
        const selectedItem = originalSelection[i];
        const personData = data[0]; // Always use the same single record
        
        console.log(`📦 Processing selection ${i + 1}: Applying single record (${personData.Name || personData.full_name || 'unnamed'})`);
        
        // Temporarily make this the only selection
        figma.currentPage.selection = [selectedItem];
        
        // Apply single record using existing working logic
        const result = await applySingleRecord([personData]);
        
        totalProcessed += result.processedCount;
        totalErrors += result.errorCount;
        result.missingKeys.forEach(key => allMissingKeys.add(key));
      }
      
      // Restore original selection
      figma.currentPage.selection = originalSelection;
      
      // Send final result
      let message = '';
      let success = true;
      
      if (totalProcessed > 0) {
        message += `✅ Updated ${totalProcessed} text layer${totalProcessed === 1 ? '' : 's'}`;
      }
      
      if (allMissingKeys.size > 0) {
        const missingKeysList = Array.from(allMissingKeys).join(', ');
        message += `\n❌ Missing JSON keys: ${missingKeysList}`;
        figma.notify(`Missing keys in JSON data: ${missingKeysList}`, { timeout: 3000 });
        success = false;
      }
      
      if (totalProcessed === 0 && totalErrors === 0) {
        message = 'No matching layers found. Layer names should be formatted as {{keyname}}';
        success = false;
      }
      
      console.log(`🏁 Final results: ${totalProcessed} processed, ${totalErrors} errors`);
      
      figma.ui.postMessage({
        type: 'processing-complete',
        success: success,
        message: message || 'Processing completed'
      });
      
      return;
    }

    // MULTIPLE RECORDS MODE - Iterate through selections
    console.log(`🔄 MULTIPLE RECORDS MODE - Iterating through ${originalSelection.length} selections with ${data.length} data records`);
    
    let totalProcessed = 0;
    let totalErrors = 0;
    const allMissingKeys = new Set();
    
    for (let i = 0; i < originalSelection.length; i++) {
      const selectedItem = originalSelection[i];
      const recordIndex = i % data.length; // Cycle through data
      const personData = data[recordIndex];
      
      console.log(`📦 Processing selection ${i + 1}: Applying record ${recordIndex + 1} (${personData.full_name || 'unnamed'})`);
      
      // Temporarily make this the only selection
      figma.currentPage.selection = [selectedItem];
      
      // Apply single record using existing working logic
      const result = await applySingleRecord([personData]);
      
      totalProcessed += result.processedCount;
      totalErrors += result.errorCount;
      result.missingKeys.forEach(key => allMissingKeys.add(key));
    }
    
    // Restore original selection
    figma.currentPage.selection = originalSelection;
    
    // Send final result
    let message = '';
    let success = true;
    
    if (totalProcessed > 0) {
      message += `✅ Updated ${totalProcessed} text layer${totalProcessed === 1 ? '' : 's'}`;
    }
    
    if (allMissingKeys.size > 0) {
      const missingKeysList = Array.from(allMissingKeys).join(', ');
      message += `\n❌ Missing JSON keys: ${missingKeysList}`;
      figma.notify(`Missing keys in JSON data: ${missingKeysList}`, { timeout: 3000 });
      success = false;
    }
    
    if (totalProcessed === 0 && totalErrors === 0) {
      message = 'No matching layers found. Layer names should be formatted as {{keyname}}';
      success = false;
    }
    
    console.log(`🏁 Final results: ${totalProcessed} processed, ${totalErrors} errors`);
    
    figma.ui.postMessage({
      type: 'processing-complete',
      success: success,
      message: message || 'Processing completed'
    });
    
  } catch (error) {
    // Restore original selection in case of error
    figma.currentPage.selection = originalSelection;
    
    figma.ui.postMessage({
      type: 'processing-complete',
      success: false,
      message: `Error: ${error.message}`
    });
  }
}

// ============================================================================
// SINGLE RECORD APPLICATION (The Working Logic)
// ============================================================================

async function applySingleRecord(data) {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    return { processedCount: 0, errorCount: 0, missingKeys: new Set() };
  }

  // 1. Find all text nodes
  let allTextNodes = [];
  for (const selectedNode of selection) {
    allTextNodes.push(...findAllTextNodes(selectedNode));
  }

  if (allTextNodes.length === 0) {
    return { processedCount: 0, errorCount: 0, missingKeys: new Set() };
  }

  // 2. Get the single person's data and flatten it
  const personData = data[0];
  const flattenedData = flattenObject(personData);
  
  console.log(`🔍 Processing ${allTextNodes.length} text nodes with single record`);
  console.log(`📊 Available flattened keys: ${Object.keys(flattenedData).slice(0, 5).join(', ')}...`);

  // 3. Group text nodes by field name to track instances
  const fieldGroups = new Map();
  allTextNodes.forEach(textNode => {
    if (!hasValidLayerFormat(textNode.name)) return;
    
    const fieldName = extractKeyFromLayerName(textNode.name);
    if (!fieldName) return;
    
    if (!fieldGroups.has(fieldName)) {
      fieldGroups.set(fieldName, []);
    }
    fieldGroups.get(fieldName).push(textNode);
  });

  // 4. Apply data to each field group with proper array indexing
  let processedCount = 0;
  let errorCount = 0;
  const missingKeys = new Set();

  for (const [fieldName, textNodes] of fieldGroups.entries()) {
    console.log(`🔍 Processing ${textNodes.length} instances of ${fieldName}`);
    
    for (let instanceIndex = 0; instanceIndex < textNodes.length; instanceIndex++) {
      const textNode = textNodes[instanceIndex];
      
      try {
        await figma.loadFontAsync(textNode.fontName);
        
        // Try to find value - check direct key first, then nested paths with proper indexing
        let value = flattenedData[fieldName];
        let usedPath = fieldName;
        
        if (value === undefined) {
          // Look for nested paths that end with this field name OR start with this field name (for arrays)
          const matchingKeys = Object.keys(flattenedData).filter(key => {
            const keyParts = key.split(/[\.\[\]]+/).filter(Boolean);
            // Match if key ends with field name (nested objects) OR starts with field name (arrays)
            return keyParts[keyParts.length - 1] === fieldName || keyParts[0] === fieldName;
          });
          
          if (matchingKeys.length > 0) {
            // Sort matching keys to ensure proper numerical order (e.g., experience.0, experience.1, experience.2)
            matchingKeys.sort((a, b) => {
              const aMatch = a.match(/\.(\d+)\./);
              const bMatch = b.match(/\.(\d+)\./);
              if (aMatch && bMatch) {
                return parseInt(aMatch[1]) - parseInt(bMatch[1]);
              }
              return a.localeCompare(b);
            });
            
            // For multiple instances, try to use the instance index to pick the right array element
            const targetKey = matchingKeys[instanceIndex] || matchingKeys[0];
            value = flattenedData[targetKey];
            usedPath = targetKey;
            console.log(`  ✅ ${fieldName}[${instanceIndex}] → "${value}" (via ${usedPath})`);
          }
        } else {
          console.log(`  ✅ ${fieldName}[${instanceIndex}] → "${value}"`);
        }
        
        if (value !== undefined && value !== '') {
          textNode.characters = String(value);
          processedCount++;
        } else {
          console.log(`  ❌ ${fieldName}[${instanceIndex}] → No value found`);
          missingKeys.add(fieldName);
          errorCount++;
        }
        
      } catch (fontError) {
        console.log(`Font loading error for ${fieldName}[${instanceIndex}]:`, fontError);
        errorCount++;
      }
    }
  }

  return { processedCount, errorCount, missingKeys };
}

// ============================================================================
// SIMPLIFIED MAPPING FUNCTIONS
// ============================================================================

async function findTextForMappingSimplified(datasetName) {
  try {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.ui.postMessage({
        type: 'text-found-for-mapping',
        success: false,
        message: 'Please select some objects containing text first'
      });
      return;
    }
    
    let allTextNodes = [];
    for (const selectedNode of selection) {
      allTextNodes.push(...findAllTextNodes(selectedNode));
    }
    
    if (allTextNodes.length === 0) {
      figma.ui.postMessage({
        type: 'text-found-for-mapping',
        success: false,
        message: 'No text objects found in selection'
      });
      return;
    }
    
    // Group by layer name
    const layerGroups = new Map();
    allTextNodes.forEach(node => {
      const layerName = node.name;
      if (!layerGroups.has(layerName)) {
        layerGroups.set(layerName, {
          layerName: layerName,
          nodeIds: [],
          examples: []
        });
      }
      
      layerGroups.get(layerName).nodeIds.push(node.id);
      layerGroups.get(layerName).examples.push(node.characters);
    });
    
    const layerItems = Array.from(layerGroups.values()).map(group => ({
      layerName: group.layerName,
      nodeIds: group.nodeIds,
      count: group.nodeIds.length,
      type: 'individual',
      examples: [...new Set(group.examples)].slice(0, 3)
    }));
    
    figma.ui.postMessage({
      type: 'text-found-for-mapping',
      success: true,
      datasetName: datasetName,
      layerItems: layerItems,
      patterns: []
    });
    
  } catch (error) {
    figma.ui.postMessage({
      type: 'text-found-for-mapping',
      success: false,
      message: `Error: ${error.message}`
    });
  }
}

async function processTextMapping(mappings) {
  try {
    let processedCount = 0;
    let errorCount = 0;
    
    for (const mapping of mappings) {
      for (const nodeId of mapping.layerItem.nodeIds) {
        const textNode = figma.getNodeById(nodeId);
        
        if (textNode && textNode.type === 'TEXT') {
          textNode.name = `{{${mapping.fieldName}}}`;
          processedCount++;
        } else {
          errorCount++;
        }
      }
    }
    
    let message = '';
    if (processedCount > 0) {
      message = `✅ Updated ${processedCount} layer name${processedCount === 1 ? '' : 's'} to {{fieldname}} format`;
    }
    
    if (errorCount > 0) {
      message += `\n⚠️ Failed to update ${errorCount} layer${errorCount === 1 ? '' : 's'}`;
    }
    
    figma.ui.postMessage({
      type: 'mapping-complete',
      success: processedCount > 0,
      message: message || 'No layers were updated'
    });
    
  } catch (error) {
    figma.ui.postMessage({
      type: 'mapping-complete',
      success: false,
      message: `Error: ${error.message}`
    });
  }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'load-saved-data':
      await loadSavedData();
      break;
      
    case 'load-datasets':
      await loadSavedDatasets();
      break;
      
    case 'save-dataset':
      await saveDataset(msg.name, msg.data);
      break;
      
    case 'delete-dataset':
      await deleteDataset(msg.name);
      break;
      
    case 'process-content-swap':
      await processContentSwapSimplified(msg.data);
      break;
      
    case 'find-text-for-mapping':
      await findTextForMappingSimplified(msg.datasetName);
      break;
      
    case 'process-text-mapping':
      await processTextMapping(msg.mappings);
      break;
      
    case 'close':
      figma.closePlugin();
      break;
      
    default:
      console.log('Unknown message type:', msg.type);
  }
}; 