# Engineering & Physics Notes

1. **L-Band Interferometric Phase Math (GUNW)**:
   - NISAR L-band center wavelength $\lambda \approx 24\text{ cm}$.
   - Line-of-Sight displacement $\Delta R_{\text{LOS}} = \frac{\Delta\phi \cdot \lambda}{4\pi}$, giving $12.0\text{ cm}$ per $2\pi$ radian fringe.
   - Zones with interferometric coherence $\gamma < 0.35$ (e.g., Nanao Bay liquefaction sediments or Anamizu dense cedar slopes) are visually masked via the interactive Coherence Filter slider to highlight decorrelation limits.

2. **Dual-Polarimetric GCOV Discrimination**:
   - **Specular Water (`HH <= -18.0 dB`)**: Smooth flooded surfaces act like a microwave mirror away from the side-looking antenna.
   - **Double-Bounce (`HH` moderate-low + `HV >= -13.0 dB`)**: Emergent paddy/grassland stalks above standing floodwater create corner-reflector returns and cross-polarized scattering.
   - **Volume Canopy (`HV >= -12.5 dB`)**: Dense Bt cotton and forest canopies depolarize L-band signals proportional to moisture and biomass.

3. **NASA GIBS Optical Date Alignment**:
   - NASA GIBS WMTS serves historical/current MODIS Terra Corrected Reflectance tiles. A valid monsoon/spring reference tile date (`2024-08-14` / `2024-05-18`) is paired with a procedural cloud-occlusion veil scaled to each orbital pass's `cloudCoverPct` so the split-screen contrast remains legible both online and offline.
