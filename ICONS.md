# Creating a Custom App Icon for KitStash (PWA)

The app now supports PWA features (installable on your phone's home screen). For the best experience, you should replace the placeholder icons with custom ones.

**Updated for race cars:** Since you mostly build race cars, the current icons feature stylized scale model race cars (NASCAR/F1 style) in kit boxes. Two variations are included.

## Current Setup
- `public/manifest.json` references icons in `/icons/`
- Layout has apple touch icon support
- Currently using a generated starting image at `public/icons/icon-512.jpg` (with JPG fallbacks for 512px and apple-touch-icon while you prepare proper PNGs).

## Quick Way to Generate All Required Icons

1. **Download the generated icon** (or create your own):
   - Two new AI-generated race car themed icons (since you mostly build race cars):
     - `public/icons/icon-512-racecar-v2.jpg` (the v2 you like — clean line-art low-slung race car) ← this is now the primary
     - `public/icons/icon-512-racecar-v2-transparent-base.jpg` (the edited version intended as a starting point for removing the black background)
   - Also updated `apple-touch-icon.jpg` to the v2.
   - **About the black background and transparency:**
     - JPG files (like the current ones) have a solid opaque black background — no transparency.
     - For proper PWA "maskable" icons (especially on Android), you want a **PNG with transparent background**. This allows the operating system to apply its own icon shape/mask without a hard black square showing.
     - Use `icon-512-racecar-v2-transparent-base.jpg` (or the main v2.jpg) as starting point.
     - Go to https://www.photopea.com/ (free, browser-based, no install).
     - File > Open the base jpg.
     - Use Magic Wand tool (tolerance ~20-30), click the black areas, Select > Inverse if needed, then Delete to remove black (you should see checkerboard = transparent).
     - For best maskable: ensure the race car is centered with ~20% padding on all sides.
     - Image > Image Size to make 512x512 and 192x192 versions.
     - Export as PNG (File > Export As > PNG).
     - Save as `icon-512-racecar-v2.png` and `icon-192-racecar-v2.png` in public/icons/.

2. **Best free tool: RealFaviconGenerator** (recommended)
   - Go to: https://realfavicongenerator.net/
   - Upload your base image (the 512px one)
   - Configure:
     - App name: KitStash
     - Theme color: #18181b (matches the app)
     - Background color: #09090b
   - Generate and download the package.
   - Copy the generated `icons/` folder contents into your `public/icons/`
   - It will also give you updated `<link>` tags — we can add them to layout.tsx if needed.

3. **Alternative: Manual sizes (if you have an image editor)**
   Create these PNG files in `public/icons/`:

   | File                          | Size     | Purpose                     |
   |-------------------------------|----------|-----------------------------|
   | icon-512-racecar-v2.png       | 512x512  | PWA high-res + maskable     |
   | icon-192-racecar-v2.png       | 192x192  | PWA standard icon (recommended, add when ready) |
   | apple-touch-icon.png          | 180x180  | iOS / Safari home screen (optional, create if you want transparent version) |
   | favicon-32x32.png             | 32x32    | Browser tab (optional)      |

   - Make the icon square with safe padding (important for "maskable" icons).
   - For the transparent PNG version: remove the black background entirely so the race car is on transparent. The icon itself uses dark lines on the car with amber accents.
   - For maskable: keep important content in the center 80% circle.

4. **Update the manifest** (after adding files)
   The manifest is already configured for `icon-512-racecar-v2.png` (with maskable) and the JPG fallback. Add the 192 version when you create it.

## Design Ideas for KitStash Icon (Race Car Theme)
- Dark charcoal background (#18181b)
- Stylized 1/24 or 1/18 scale race car (NASCAR, F1, classic Le Mans style)
- Inside a model kit box or on a small workbench display
- Subtle amber/orange accents to match the app theme
- Or a clean "KS" monogram with a low-slung race car silhouette
- Minimalist, clean vector style, high contrast, readable at small sizes
- Keep important details centered for maskable icons

## After Adding Icons
- You now have the transparent 512 PNG for v2 (icon-512-racecar-v2.png). The manifest already includes both 512 and 192 entries.
- Create a 192x192 version too for best results (name it icon-192-racecar-v2.png).
- Optionally create apple-touch-icon.png for a transparent iOS icon.
- Rebuild and redeploy: `npm run build` then push to GitHub (Vercel will pick it up)
- Test on phone: Add to Home Screen and check the icon looks good (no weird cropping)

If you create or generate new icons and want me to update any code (manifest, layout, etc.), just drop the files in `public/icons/` and let me know the filenames!

Need help with a specific design prompt for another AI-generated icon? I can generate variations.