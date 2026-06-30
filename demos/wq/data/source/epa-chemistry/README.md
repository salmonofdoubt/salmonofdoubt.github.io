# EPA / Catchments.ie official chemistry downloads

Put official chemistry CSV/XLSX files downloaded from Catchments.ie / EPA here.

Target focus areas:
- Broadmeadow_SC_010 / 08_3
- Mayne_SC_010 / 09_17
- Delvin_SC_010 / 08_1
- Nanny[Meath]_SC_010 / 08_4
- Nanny[Meath]_SC_020 / 08_5
- Any waterbody-level chemistry download for Broadmeadow Water, Mayne Estuary, Malahide Bay, Delvin or Nanny waterbodies.

The harvester accepts common long-format chemistry columns such as:

sample_date,date,sampling_date
station_code,monitoring_station_code,station
station_name,monitoring_station_name,location
waterbody_code,water_body_code
waterbody_name,water_body_name
determinand,parameter,parameter_name,analyte
result,value,result_value,concentration
unit,units

CSV, TSV and XLSX are supported. The app will not invent chemistry values. If this folder is empty, the official chemistry source is shown as empty.
