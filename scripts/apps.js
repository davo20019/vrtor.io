// The subject apps in apps/, in one place. The root build, deploy and dev scripts read this list,
// so a new subject is added here once (see docs/adding-a-subject.md).
// `port` is where `npm run dev` serves that app's Worker locally; its inspector is port + 450.
// The home Worker (apps/home) routes to each through a service binding, so every subject is
// deployed before it.
export const SUBJECTS = [
  { code: 'spc', port: 8791 },
  { code: 'taj', port: 8792 },
  { code: 'mpc', port: 8793 },
  { code: 'apo', port: 8794 },
  { code: 'fly', port: 8795 },
  { code: 'orca', port: 8796 },
  { code: 'geo', port: 8797 },
  { code: 'jump', port: 8798 },
  { code: 'cyb', port: 8799 },
  { code: 'snd', port: 8800 },
  { code: 'rds', port: 8801 },
  { code: 'bdy', port: 8802 },
  { code: 'aif', port: 8803 },
  { code: 'cel', port: 8804 },
  { code: 'hrt', port: 8805 },
  { code: 'mona', port: 8806 },
  { code: 'sacre', port: 8807 },
  { code: 'giza', port: 8808 },
];

export const HOME = { code: 'home', port: 8790 };

export const inspectorPort = (app) => app.port + 450;
