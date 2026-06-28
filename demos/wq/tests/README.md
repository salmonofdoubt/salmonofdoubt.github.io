# WQ tests

Run from repository root:

cd demos/wq
npm run test:cq

Current coverage:
- C-Q engine module imports correctly.
- Positive slope is classified as Activation.
- Negative slope is classified as Dilution.
- Near-zero slope is classified as Weak / chemostatic.
- Failed regression reports Not fitted.

Next coverage to add:
- imported q_proxy_m3_s pairing
- all-location screening suppresses pooled regression
- single-location regression requires enough Q variety
- wide CSV rows remain one sample with multiple analytes
