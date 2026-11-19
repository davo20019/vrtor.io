# Taj Mahal (`/taj/`)

The first World Wonders lesson is a detailed exterior reconstruction with four observation-and-answer activities: symmetry, pishtaqs, minarets, and chhatris. It reuses the shared WebXR shell, with terrace teleporting, comfort fades, adaptive eye-buffer resolution, MSAA, and compositor text panels. Morning/afternoon lighting refreshes the static shadow map only when changed.

The downloadable CC BY model retains all 409,419 triangles in the downloaded GLB (29 mesh draws), delivered as a 4.8 MB Draco GLB. Scale is approximate, with the plinth normalized to 95.4m; the garden approach is illustrative and no interior is modeled. Credit and source links are visible in the experience and in `apps/home/public/assets/CREDITS.md`. This was selected over the other accessible free assets for modeled detail and a smaller, texture-independent payload; paid models were not purchased. Actual Quest frame rate and visual clarity require a headset check.

Build: `npm run build -w @vrtor/taj`. Deploy its Worker before the home Worker, which routes through the `TAJ` service binding. `npm run dev`, `npm run build`, and `npm run deploy` include both subject apps. `vrtor.io/taj-mahal` and `vrtor.io/tajmahal` redirect to `/taj/`.

The asset conversion is reproducible with Blender and `scripts/prepare-taj.py`; see its invocation at the top of the script.
