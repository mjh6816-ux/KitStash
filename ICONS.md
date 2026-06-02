# Creating a Custom App Icon for KitStash (PWA)

The app now supports PWA features (installable on your phone's home screen). For the best experience, you should replace the placeholder icons with custom ones.

**Updated for race cars:** Since you mostly build race cars, the current icons feature stylized scale model race cars (NASCAR/F1 style) in kit boxes. Two variations are included.

## Current Setup
- `public/manifest.json` references the race-car v2 icons (PNG preferred for transparency + maskable)
- `app/layout.tsx` has proper apple touch icon support (prefers .png)
- You have created:
  - icon-512-racecar-v2.png (transparent 512px, main PWA + maskable icon)
  - apple-touch-icon.png (for iOS home screen)
- JPG fallbacks remain for compatibility during transition.

## Quick Way to Generate All Required Icons

1. **You have created the icons** (great!):
   - `public/icons/icon-512-racecar-v2.png` (your transparent 512px version — primary for PWA)
   - `public/icons/apple-touch-icon.png` (your new one for iOS)
   - JPG fallbacks are still there for compatibility.
   - **About the black background and transparency:**
     - JPG files have a solid opaque black background — no transparency.
     - The PNG you created has transparent background (checkerboard in editors), which is what we want for maskable icons on Android etc. The system can now shape the icon properly without a black box.

2. **(Optional) Best free tool for complete favicon set: RealFaviconGenerator**
   - Go to: https://realfavicongenerator.net/
   - Upload your base image (e.g. the 512px png or jpg)
   - Configure:
     - App name: KitStash
     - Theme color: #18181b (matches the app)
     - Background color: #09090b
   - Generate and download the package.
   - It will give you all sizes + a favicon.ico, and updated link tags if you want to enhance the head.

3. **(Optional) Manual sizes (if you want to add the 192px or favicon.ico)**
   Create these PNG files in `public/icons/` if missing:

   | File                          | Size     | Purpose                     |
   |-------------------------------|----------|-----------------------------|
   | icon-512-racecar-v2.png       | 512x512  | PWA high-res + maskable (you have this) |
   | icon-192-racecar-v2.png       | 192x192  | PWA standard icon (recommended) |
   | apple-touch-icon.png          | 180x180  | iOS / Safari home screen (you have this) |
   | favicon-32x32.png             | 32x32    | Browser tab (optional)      |

   - Make the icon square with safe padding (important for "maskable" icons).
   - The transparent PNG version should have the black background removed so the race car is on transparent. The icon itself uses dark lines on the car with amber accents.
   - For maskable: keep important content in the center 80% circle.

4. **Manifest & Layout**
   The `public/manifest.json` is already set up to use your new PNGs (512 first with maskable, then 192 placeholder, JPG fallback).
   The layout in `app/layout.tsx` already prefers the apple-touch-icon.png you created.
   No code changes needed unless you use different filenames.

## Design Ideas for KitStash Icon (Race Car Theme)
- Dark charcoal background (#18181b)
- Stylized 1/24 or 1/18 scale race car (NASCAR, F1, classic Le Mans style)
- Inside a model kit box or on a small workbench display
- Subtle amber/orange accents to match the app theme
- Or a clean "KS" monogram with a low-slung race car silhouette
- Minimalist, clean vector style, high contrast, readable at small sizes
- Keep important details centered for maskable icons

## After Adding Icons
- You now have the transparent 512 PNG for v2 (icon-512-racecar-v2.png) and apple-touch-icon.png.
- Create icon-192-racecar-v2.png when ready (then add the entry back to manifest.json and layout.tsx icon array for full sizes).
- JPG fallbacks are still present (harmless).
- Rebuild and redeploy: `npm run build` then push to GitHub (Vercel will pick it up)
- Test on phone: Add to Home Screen and check the icon looks good (no weird cropping, transparent background for maskable)

If you create additional icons (like the 192px version) or generate new variations and want me to update any code (manifest, layout, etc.), just drop the files in `public/icons/` and let me know the filenames!

Need help with a specific design prompt for another AI-generated icon? I can generate variations.