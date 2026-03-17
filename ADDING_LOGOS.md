# Adding Official Government Logos

## Overview
BILAHUJAN uses government organization logos in:
- **ReportScreen** → Department selector buttons (JPS, NADMA, APM)
- **Government Dashboard** → Header branding & authority icons
- **Data Export** → Report headers for official submissions

---

## Folder Structure
```
src/
  assets/
    logos/
      jps.svg       (Department of Irrigation & Drainage)
      nadma.svg     (National Disaster Management Agency)
      apm.svg       (Malaysia Civil Defence Force)
      jps.png       (fallback PNG version)
      nadma.png     (fallback PNG version)
      apm.png       (fallback PNG version)
```

---

## Adding Logos

### Step 1: Download Official Logos

Use these authoritative sources:

| Agency | Logo URL | Format |
|:---|:---|:---|
| **JPS** | [Wikimedia Commons](https://upload.wikimedia.org/wikipedia/commons/1/1a/Department_of_Irrigation_and_Drainage_%28Malaysia%29_logo.svg) | SVG or PNG |
| **NADMA** | [Wikimedia Commons](https://upload.wikimedia.org/wikipedia/commons/5/52/National_Disaster_Management_Agency_%28Malaysia%29_logo.svg) | SVG or PNG |
| **APM (Civil Defence)** | [Wikimedia Commons](https://upload.wikimedia.org/wikipedia/commons/7/7b/Malaysia_Civil_Defence_Force_logo.svg) | SVG or PNG |

### Step 2: Save to Assets Folder

Move downloaded files to:
```
src/assets/logos/
├── jps.svg
├── nadma.svg
└── apm.svg
```

### Step 3: Update ReportScreen.tsx

The logos are currently used from URLs. To enable **local logos**, update line ~10:

```typescript
// Current (URL-based):
import { officialLogos } from '../data/officialLogos';

// To use local files, add imports:
import jpsLogo from '../assets/logos/jps.svg';
import nadmaLogo from '../assets/logos/nadma.svg';
import apmLogo from '../assets/logos/apm.svg';
```

Then in the `selectedDepts` render section (line ~550):

```typescript
// Change from:
<img 
  src={officialLogos[dept].logo}  // URL-based
  alt={selectedDepts[dept].name}
/>

// To:
<img 
  src={dept === 'JPS' ? jpsLogo : dept === 'NADMA' ? nadmaLogo : apmLogo}
  alt={dept}
/>
```

---

## Current Implementation

**File**: `src/data/officialLogos.ts`

```typescript
export const officialLogos = {
  JPS: {
    name: 'Department of Irrigation & Drainage',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/...',
    contact: '+60 3 2619-0000'
  },
  NADMA: {
    name: 'National Disaster Management Agency',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/52/...',
    contact: '+60 3 8064-2400'
  },
  APM: {
    name: 'Malaysia Civil Defence Force',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/...',
    contact: '+60 3 2715-3000'
  }
};
```

---

## Using Logos in Components

### ReportScreen (Department Selector)
```typescript
{['JPS', 'NADMA', 'APM'].map(dept => (
  <button
    key={dept}
    className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
      selectedDepts.includes(dept)
        ? 'border-[#ec5b13] bg-orange-50'
        : 'border-slate-200 hover:border-[#ec5b13]'
    }`}
    onClick={() => toggleDept(dept)}
  >
    <img 
      src={officialLogos[dept].logo}
      alt={dept}
      className="w-6 h-6 object-contain"
    />
    <span className="font-bold text-sm">{dept}</span>
  </button>
))}
```

### Government Dashboard (Header)
```typescript
<div className="flex items-center gap-2 mb-3">
  <span className="text-blue-300 font-bold">JPS • NADMA • APM</span>
</div>
```

---

## Testing Logos

1. Start dev server:
```bash
npm run dev
```

2. Navigate to **ReportScreen** (Camera tab → "Report a Flood")
3. Scroll to "Notify Authority" section
4. Verify logos appear for JPS, NADMA, APM buttons

5. Check **Government Dashboard** (Dashboard tab)
   - Logos should appear in authority header

---

## Logo Optimization

### File Size Recommendations
- SVG: < 50 KB per logo
- PNG: < 200 KB per logo (use 256x256 px)

### Web Optimization
If using PNGs, optimize with:
```bash
npx imagemin src/assets/logos/*.png --out-dir=src/assets/logos
```

---

## Fallback Strategy

If logos fail to load:
```typescript
<img 
  src={officialLogo}
  alt="Government Agency"
  onError={(e) => {
    e.currentTarget.src = 'data:image/svg+xml,...'; // fallback SVG
  }}
/>
```
import nadmaLogo from '../assets/logos/nadma.svg';
import apmLogo from '../assets/logos/apm.svg';
```

**Update the logo references** (around line 605-635):
```typescript
// Change from:
logo: 'https://upload.wikimedia.org/wikipedia/...'

// To:
logo: jpsLogo    // for JPS
logo: nadmaLogo  // for NADMA
logo: apmLogo    // for APM
```

### Option 2: Use npm Script to Auto-Download (Alternative)

If you prefer automated download, run:
```bash
node src/download_logos.cjs
```

This will download and convert logos to base64, but you'll need to update the output path in the script.

## File Format Support

The app supports:
- **SVG** (Recommended) - Scalable, small file size
- **PNG** - Good quality, transparent background
- **JPG** - Larger file size, no transparency

## Example Files Location

After adding your images:
```
✅ c:\Users\USER\Downloads\BILAHUJAN\src\assets\logos\jps.svg
✅ c:\Users\USER\Downloads\BILAHUJAN\src\assets\logos\nadma.svg
✅ c:\Users\USER\Downloads\BILAHUJAN\src\assets\logos\apm.svg
```

## Quick Test

After adding images:
1. Save the files in the logos folder
2. Uncomment the imports in ReportScreen.tsx
3. Update the logo properties to use imported variables
4. Run: `npm run dev`
5. Navigate to the Report screen
6. You should see the logos displayed!

## Troubleshooting

**Import errors?**
- Make sure file extensions match (.svg, .png, etc.)
- Check file names are lowercase
- Verify files are in the correct folder

**Images not showing?**
- Check browser console for errors
- Verify import paths are correct
- Make sure Vite can handle the image format

**Want to use PNG instead of SVG?**
Just change the import extension:
```typescript
import jpsLogo from '../assets/logos/jps.png';
```

## Alternative: Public Folder Method

If you prefer to use the public folder:

1. Create `public/logos/` folder
2. Place images there
3. Use in code as:
```typescript
logo: '/logos/jps.svg'
```

This method doesn't require imports but images won't be optimized by Vite.

---

**Current Status**: ✅ Folder created, code updated with comments
**Next Step**: Add your logo image files to `src/assets/logos/`
