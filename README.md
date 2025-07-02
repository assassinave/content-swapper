# The Replacer - Figma Plugin

**Automatically replace text content in your Figma designs using JSON data**

The Replacer is a powerful Figma plugin that lets you quickly swap out placeholder text in your designs with real data from JSON files. Perfect for creating personalized resumes, cards, profiles, or any design that needs dynamic content updates.

## ✨ What It Does

- **🔄 Bulk Content Replacement**: Replace multiple text fields at once with JSON data
- **🎯 Smart Pattern Detection**: Automatically detects similar design patterns and applies data accordingly  
- **📋 Dataset Management**: Save and reuse frequently used data sets
- **🔗 Nested Data Support**: Handle complex JSON structures with arrays and nested objects
- **⚡ Instant Preview**: See your changes applied immediately

## 🚀 Installation (Development Plugin)

### Step 1: Download the Plugin Files
1. Download or clone this repository to your computer
2. Make sure you have all the plugin files:
   - `manifest.json`
   - `code.js` 
   - `ui.html`

### Step 2: Install in Figma
1. Open **Figma Desktop** (this won't work in the web version)
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Navigate to the plugin folder and select `manifest.json`
4. Click **Open**

### Step 3: Run the Plugin
1. In any Figma file, go to **Plugins → Development → The Replacer**
2. The plugin interface will open on the right side

## 📝 How to Use

### Step 1: Add data sources

This plugin supports pasting JSON, CSV and TSV (pasted from a spreadsheet with headers)

We recommend using JSON for advanced advanced needs like multiple options within a keyname for items such as job skills or in the example below, favorite games.

1. Go to **Add Data** tab
2. **Paste** JSON, CSV or TSV data
2. **Click "Validate Data"** to confirm the plugin can read it
4. **Click "Save Data"** to give dataset a name to reference for Map Data and Content.

Example:
```json
[
{
      "name": "Alex Rodriguez",
      "gamertag": "ShadowHunter92",
      "favoriteGames": [
        { "game": "The Witcher 3: Wild Hunt" },
        { "game": "Dark Souls III" },
        { "game": "Cyberpunk 2077" },
        { "game": "Elden Ring" }
      ]
    },
    {
      "name": "Sarah Chen",
      "gamertag": "PixelNinja",
      "favoriteGames": [
        { "game": "Overwatch 2" },
        { "game": "Valorant" },
        { "game": "Apex Legends" },
        { "game": "Counter-Strike 2" }
      ]
    }
]
```

### Step 2: Map Data

Use Map Data to automatically rename multiple layers to {{fieldname}} format for replacement
1. **Select** a frame or group containing text layers with existing names 
2. Go to "Map Data" tab and click "Find Data" for your saved dataset  
3. Map layer names to data fields (duplicates are grouped automatically)  
4. **Click "Map Data"** to batch rename all selected layers

You can also manually modify your layers, but who has the time for that!

**Examples:**
- `{{full_name}}` - Will be replaced with data from JSON field "full_name"
- `{{job_title}}` - Will be replaced with data from JSON field "job_title"  
- `{{company_name}}` - Will be replaced with data from JSON field "company_name"

### Step 3: Apply the Content

1. Go to **Content** tab
2. **Select** the design elements you want to update (frames, groups) now or have previously
2. **Click "Apply All"** to replace content across all selected elements
4. **Or click "Apply"** to apply data to one object at a time from the dropdown



## 💡 Pro Tips

### 1. Layer Organization
Keep your text layers organized in frames or groups. The plugin works best when similar elements are contained together.

### 2. Multiple Records
When you have multiple JSON records, the plugin will:
- Apply different records to different selected containers
- It will continue to cycle through back to the original record and apply if you have more selections than records

### 3. Single Updates
You can use the "Apply" button in the dataset dropdown in *Content* to test it with any individual record.

## 🔧 Troubleshooting

**"Missing JSON keys" error?**
- Check that your layer names exactly match your JSON field names
- Make sure you're using the `{{field_name}}` format
- Verify your JSON is valid (use a JSON validator)

**Plugin not detecting patterns?**
- Make sure similar elements are grouped in frames
- Check that text layers are named consistently
- Try selecting individual groups instead of everything at once

**Data not applying correctly?**
- Ensure your selected elements contain the named text layers
- Check that your JSON structure matches your layer naming
- Try with simpler data first, then add complexity

## 🆘 Support

If you encounter issues:
1. Check that all layer names use the `{{field_name}}` format
2. Validate your JSON data is properly formatted
3. Make sure you're using Figma Desktop (not web version)
4. Try with a simple example first

## 📄 Example Files

The plugin works great with data like:
- **Resume/CV content** (personal info, experience, education)  
- **Team member profiles** (names, roles, photos, bios)
- **Product catalogs** (names, prices, descriptions)
- **Event listings** (dates, locations, speakers)
- **Testimonials** (quotes, names, companies)

Happy designing! 🎨 
