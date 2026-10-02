// Where you can drop in. lat/lon in degrees. `ground` is the street's rough height above
// sea level (the terrain tiles' heights), only used until the first raycast finds the real
// ground. `heading` is the compass direction you face on arrival. `walk` links to a vrtor
// subject where you can walk the place in detail.
export const PLACES = [
  { name: 'New York', spot: 'Midtown Manhattan', lat: 40.7580, lon: -73.9855, ground: 15, heading: 30 },
  { name: 'Paris', spot: 'the Eiffel Tower', lat: 48.8559, lon: 2.2984, ground: 35, heading: 310 },
  { name: 'Rio', spot: 'Sugarloaf and the bay', lat: -22.9519, lon: -43.2105, ground: 700, heading: 120 },
  { name: 'Quito', spot: 'the old town', lat: -0.2201, lon: -78.5123, ground: 2850, heading: 0 },
  { name: 'Giza', spot: 'the Pyramids', lat: 29.9765, lon: 31.1290, ground: 60, heading: 50 },
  { name: 'Rome', spot: 'the Colosseum', lat: 41.8902, lon: 12.4922, ground: 25, heading: 90 },
  { name: 'Tokyo', spot: 'Shibuya', lat: 35.6595, lon: 139.7005, ground: 35, heading: 0 },
  { name: 'Sydney', spot: 'the harbour', lat: -33.8590, lon: 151.2120, ground: 5, heading: 60 },
  { name: 'Everest', spot: 'the summit ridge', lat: 27.9881, lon: 86.9250, ground: 8800, heading: 200 },
  { name: 'Matterhorn', spot: 'the Swiss Alps', lat: 45.9763, lon: 7.6586, ground: 4400, heading: 270 },
  { name: 'Grand Canyon', spot: 'the South Rim', lat: 36.0544, lon: -112.1401, ground: 2100, heading: 0 },
  { name: 'Machu Picchu', spot: 'the citadel', lat: -13.1631, lon: -72.5450, ground: 2430, heading: 330, walk: '/mpc/' },
  { name: 'Taj Mahal', spot: 'the gardens', lat: 27.1735, lon: 78.0421, ground: 170, heading: 0, walk: '/taj/' },
];
