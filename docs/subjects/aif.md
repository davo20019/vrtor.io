# AI foundations (`vrtor.io/aif/`)

The building blocks of AI, learned hands-on with one running example: sorting apples and oranges.
`vrtor.io/ai`, `/ml`, `/machine-learning` and `/ai-foundations` redirect here. Its catalog card
(`apps/home/public/assets/cards/ai-foundations.jpg`) is a headless render of step 5. Five steps, one room:

1. **Data**: sort 16 real-size fruit into two baskets (grip to grab, or point and trigger, or click).
   Each sorted fruit becomes a dot on the wall board: size across, colour (hue) up. Wrong labels are
   kept, so the machine learns your mistakes too.
2. **A neuron**: a machine with two sliding dials, `size × w1 + colour × w2`, above 0 orange. No bias:
   the inputs are centred on the first fruit, so two dials are enough. The board shades what it would
   say everywhere and rings each fruit it gets wrong.
3. **Error**: a tube filled with the average cross-entropy (plus a small 0.02 weight penalty, so the
   lowest point is on the table); a green ring marks the lowest reachable error.
4. **Learning**: the real error landscape of those two dials on a round table (two dials and the error
   are exactly three numbers; only the height is squeezed by `1 - exp(-loss / 1.2)`). The ball is the
   neuron; gradient descent rolls it down with small / good / too big steps and optional momentum.
   Grab the ball, or click the landscape, to drop it anywhere. The dials stop at ±6.
5. **A network**: six green apples (hue ~85 to 110) put apples on both sides of the oranges, so one
   straight line can't separate them. A 2-H-1 sigmoid network (H = 1 to 6, Adam) learns a band; wires
   show weights. "Show it a new fruit" tests it on fruit it never trained on.

All the math is in `apps/aif/src/model.js`, checked by `npm test -w @vrtor/aif` (one neuron leaves only
the two overlapping fruit wrong, green apples defeat it, four or more hidden neurons fix it). `?step=1..6`
opens a step; `?xrdebug` exposes `window.aif`. Physical headset checks still to do: grab reach on the
dial handles and fruit, card placement beside each station, and frame rate.
