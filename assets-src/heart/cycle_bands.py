"""The cycle's clock and the contraction bands, shared by parts.py and (as numbers) apps/hrt/src/cycle.js."""
import numpy as np
RR = 800.0
QRS_AT = RR - 30          # the QRS starts 30 ms before the ventricles start to contract (t = 0)
PR = 150.0
SA_AT = QRS_AT - PR       # the SA node fires a PR interval before the QRS
VENT_BANDS = [8.0, 32.0, 56.0, 80.0]      # ms after the QRS's onset, across the 95 ms QRS
ATR_BANDS = [10.0, 40.0, 70.0, 100.0]     # ms after the SA node fires, across the 105 ms P wave
MECH = 0.6                # contraction spreads over 60% of the activation's spread

def weights(rel, centres):
    """Linear partition of unity over the band centres: each vertex's motion shared between its two nearest bands."""
    c = np.asarray(centres); r = np.clip(rel, c[0], c[-1]); w = np.zeros((len(r), len(c)))
    j = np.clip(np.searchsorted(c, r) - 1, 0, len(c) - 2); t = (r - c[j]) / (c[j + 1] - c[j])
    w[np.arange(len(r)), j] = 1 - t; w[np.arange(len(r)), j + 1] = t
    return w
