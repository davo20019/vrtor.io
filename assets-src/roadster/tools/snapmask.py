"""Cut-out from a hand-traced outline, snapped to the photo's edges by GrabCut in a band around it.
  .venv/bin/python tools/snapmask.py <photo> <out.png> <band px> x,y x,y ...   (outline points in photo px)
Inside the outline shrunk by the band is sure object, outside it grown by the band sure background; GrabCut
decides the band. Writes the mask and <out>_check.jpg (the photo with the mask's edge drawn)."""
import sys, cv2, numpy as np
photo, out, band = sys.argv[1], sys.argv[2], int(sys.argv[3])
pts = np.array([[float(v) for v in p.split(',')] for p in sys.argv[4:]], np.int32)
im = cv2.imread(photo)
H, W = im.shape[:2]
poly = np.zeros((H, W), np.uint8); cv2.fillPoly(poly, [pts], 1)
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * band + 1, 2 * band + 1))
fg = cv2.erode(poly, k); bgm = 1 - cv2.dilate(poly, k)
m = np.full((H, W), cv2.GC_PR_BGD, np.uint8)
m[poly > 0] = cv2.GC_PR_FGD; m[fg > 0] = cv2.GC_FGD; m[bgm > 0] = cv2.GC_BGD
bg = np.zeros((1, 65)); fgm = np.zeros((1, 65))
x0, y0, w, h = cv2.boundingRect(pts); pad = 3 * band
X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x0 + w + pad), min(H, y0 + h + pad)
sub = m[Y0:Y1, X0:X1].copy()
cv2.grabCut(im[Y0:Y1, X0:X1], sub, None, bg, fgm, 6, cv2.GC_INIT_WITH_MASK)
m[Y0:Y1, X0:X1] = sub
res = ((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD)).astype(np.uint8) * 255
n, lab, st, _ = cv2.connectedComponentsWithStats(res)
if n > 1:
    res = ((lab == 1 + np.argmax(st[1:, 4])) * 255).astype(np.uint8)
cv2.imwrite(out, res)
chk = im.copy()
cs, _ = cv2.findContours(res, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
cv2.drawContours(chk, cs, -1, (255, 0, 255), 2)
cv2.polylines(chk, [pts], True, (0, 255, 255), 1)
cv2.imwrite(out.replace('.png', '_check.jpg'), chk[Y0:Y1, X0:X1])
print('snapmask:', out, int(res.sum() / 255), 'px')
