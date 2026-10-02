// Where you can drop in. lat/lon in degrees. `ground` is a rough ellipsoid height of the
// street (sea-level elevation plus the local geoid offset), only used until the first
// raycast finds the real ground. `heading` is the compass direction you face on arrival.
export const PLACES = [
  { name: 'New York', spot: 'Midtown Manhattan', lat: 40.7580, lon: -73.9855, ground: -20, heading: 30 },
  { name: 'Paris', spot: 'the Eiffel Tower', lat: 48.8559, lon: 2.2984, ground: 80, heading: 310 },
  { name: 'Rio', spot: 'Christ the Redeemer', lat: -22.9519, lon: -43.2105, ground: 700, heading: 120 },
  { name: 'Quito', spot: 'the old town', lat: -0.2201, lon: -78.5123, ground: 2860, heading: 0 },
  { name: 'Giza', spot: 'the Pyramids', lat: 29.9765, lon: 31.1290, ground: 75, heading: 230 },
  { name: 'Rome', spot: 'the Colosseum', lat: 41.8902, lon: 12.4922, ground: 70, heading: 90 },
  { name: 'Tokyo', spot: 'Shibuya Crossing', lat: 35.6595, lon: 139.7005, ground: 75, heading: 0 },
  { name: 'Sydney', spot: 'the Opera House', lat: -33.8590, lon: 151.2120, ground: 25, heading: 60 },
  { name: 'Machu Picchu', spot: 'the citadel', lat: -13.1631, lon: -72.5450, ground: 2450, heading: 330 },
  { name: 'Taj Mahal', spot: 'the gardens', lat: 27.1735, lon: 78.0421, ground: 120, heading: 0 },
];
