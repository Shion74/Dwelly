# Dwelly Geolocation Framework - User Guide

## 🗺️ **How to Use the Enhanced Location Features**

The Dwelly geolocation framework makes it incredibly easy to add location information to your property listings using Google Maps or Apple Maps links.

### ✨ **Quick Start Guide**

#### **For Creating New Listings:**

1. **Navigate to Create Listing** (`/listings/create`)
2. **Locate the "Quick Location Setup" section** (appears early in the form)
3. **Paste your map link** in the "Map Link" field
4. **Click "Extract Location"** button (appears automatically)
5. **Watch the magic happen** - all location fields auto-fill!
6. **Review and adjust** any details if needed
7. **Complete the rest of your listing** and submit

#### **For Editing Existing Listings:**

1. **Navigate to Edit Listing** (`/listings/{id}/edit`)
2. **Find the "Update Location Quickly" section**
3. **Paste a new map link** to update location
4. **Click "Extract Location"** 
5. **Review updated location data**
6. **Save your changes**

---

## 📱 **Getting Map Links**

### **From Google Maps:**
1. **Open Google Maps** on your phone or computer
2. **Search for your property location**
3. **Tap the location marker** or business listing
4. **Tap "Share"** 
5. **Select "Copy Link"**
6. **Paste the link** in Dwelly's Map Link field

**Supported Google Maps formats:**
- `https://www.google.com/maps/place/...`
- `https://maps.app.goo.gl/...` (shortened links)
- `https://maps.google.com/...`

### **From Apple Maps:**
1. **Open Apple Maps** on your iPhone/iPad
2. **Find your location**
3. **Tap "Share"**
4. **Select "Copy"**
5. **Paste the link** in Dwelly

**Supported Apple Maps formats:**
- `https://maps.apple.com/?ll=...`
- `https://maps.apple.com/?address=...`

---

## 🎯 **What Gets Auto-Filled**

When you extract location from a map link, the following fields are automatically populated:

### **✅ Coordinates:**
- **Latitude** (e.g., 7.0724147)
- **Longitude** (e.g., 125.61276)

### **✅ Address Details:**
- **Street Address** (e.g., "123 Juan Luna Street")
- **Barangay** (e.g., "Poblacion District")
- **City** (defaults to "Davao City" for local properties)

### **✅ Map Integration:**
- **Interactive map marker** automatically updates
- **Map view** centers on your property location

---

## 🔧 **Advanced Features**

### **Real-Time Feedback**
- **Status indicators** show extraction progress
- **Success messages** confirm successful extraction
- **Error messages** help troubleshoot issues
- **Warning messages** for locations outside Davao City

### **Form Integration**
- **Auto-highlighting** of filled fields (green background)
- **Validation** ensures coordinates are within Philippines
- **Manual editing** - you can still edit auto-filled data
- **Map synchronization** - changes update the interactive map

### **Smart Validation**
- **Philippines bounds checking** (lat: 4-21, lng: 116-127)
- **Davao City focus** for student housing context
- **URL format validation** for map links
- **Coordinate precision** to 6 decimal places

---

## 🚀 **User Experience Tips**

### **For Best Results:**
1. **Use specific location pins** rather than general area searches
2. **Verify the auto-filled data** before submitting
3. **Adjust coordinates** using the interactive map if needed
4. **Save your map links** for future reference

### **Troubleshooting:**
- **"No location found"** → Try a different map link format
- **"Outside Davao City"** → Ensure your property is in the service area
- **"Invalid URL"** → Check the link format matches supported types
- **Partial data** → Some map links may only provide coordinates

### **Pro Tips:**
- 💡 **Pin exact building entrance** for most accurate results
- 💡 **Use building/business names** in Google Maps for better data
- 💡 **Test your map link** before pasting (open it to verify location)
- 💡 **Keep original map links** for future listing updates

---

## 🔒 **Security & Privacy**

### **Data Protection:**
- **No external API calls** for basic coordinate extraction
- **Secure URL parsing** protects against malicious links
- **Input validation** prevents injection attacks
- **Audit logging** tracks location extractions for security

### **Privacy Features:**
- **Optional field** - map links are not required
- **No storage** of unnecessary tracking data
- **Local processing** for most extraction operations
- **User control** over all location data

---

## 📊 **Technical Details**

### **Supported Coordinate Systems:**
- **WGS84 Decimal Degrees** (standard GPS format)
- **Precision:** 6 decimal places (~10cm accuracy)
- **Range:** Philippines bounding box validation

### **Processing Methods:**
1. **URL Pattern Matching** for direct coordinate extraction
2. **Shortened URL Resolution** for goo.gl and app.goo.gl links
3. **Reverse Geocoding** for address details (when available)
4. **Coordinate Validation** against geographic boundaries

### **Browser Compatibility:**
- ✅ **Chrome** (recommended)
- ✅ **Firefox**
- ✅ **Safari**
- ✅ **Edge**
- 📱 **Mobile browsers** supported

---

## 🆘 **Support & Help**

### **Common Issues:**

**Q: The extract button doesn't appear**
**A:** Check that you've pasted a valid map URL and the page has fully loaded

**Q: Location extraction fails**
**A:** Try using a direct Google Maps link instead of a shortened one

**Q: Coordinates are wrong**
**A:** Use the interactive map to manually adjust the marker position

**Q: Can I use international locations?**
**A:** The system is optimized for Philippines locations, particularly Davao City

### **Need More Help?**
- Check the **form validation messages** for specific guidance
- Use the **interactive map** as a backup method
- **Contact support** if you encounter persistent issues

---

## 🎨 **Visual Guide**

### **Location Fields Section:**
```
📍 Location Information
┌─────────────────────────────────────┐
│ Street Address*     [Auto-filled]   │
│ Barangay*          [Auto-filled]    │  
│ City*              [Auto-filled]    │
│ Latitude           [Auto-filled]    │
│ Longitude          [Auto-filled]    │
└─────────────────────────────────────┘
```

### **Map Link Section:**
```
🗺️ Quick Location Setup
┌─────────────────────────────────────┐
│ Map Link: [Paste URL here...]      │
│ [Extract Location] 🔄              │
│ ✅ Location extracted successfully! │
└─────────────────────────────────────┘
```

### **Interactive Map:**
```
🗺️ Interactive Map
┌─────────────────────────────────────┐
│           📍 Your Property          │
│              🏫 Mapúa               │
│          (Reference Point)          │
│                                     │
│  🔵 1km radius circle               │
└─────────────────────────────────────┘
```

---

**Happy listing! 🏠✨** 

The geolocation framework makes creating accurate, well-located listings faster and easier than ever before. 