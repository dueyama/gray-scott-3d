const DISC_N_DX = 0.01;
const DOMAIN_ONE_GRID = 100;
const DOMAIN_ONE_DX = 1 / (DOMAIN_ONE_GRID - 1);

const SNAKE_BASE = {
  gridSize: 64,
  du: 0.00002,
  dv: 0.00001,
  dt: 0.5,
  dx: DISC_N_DX,
  threshold: 0.2,
  speed: 100,
  boundary: "neumann",
  initMode: "discNTestFs"
};

const snakeParams = ({ feed, kill, seed }) => ({
  ...SNAKE_BASE,
  feed,
  kill,
  seed
});

export const PRESETS = [
  {
    id: "fk-0020-00555",
    name: "脈動スポット",
    note: "F=0.020 / k=0.0555",
    color: "#35c7b8",
    params: {
      ...snakeParams({ feed: 0.02, kill: 0.0555, seed: 5 }),
      threshold: 0.4,
      speed: 20
    }
  },
  {
    id: "fk-0020-00600",
    name: "脈動スポット",
    note: "F=0.020 / k=0.0600",
    color: "#cf6c58",
    params: {
      ...snakeParams({ feed: 0.02, kill: 0.06, seed: 5 }),
      threshold: 0.4,
      speed: 20
    }
  },
  {
    id: "fk-0025-00575",
    name: "脈動 Tube",
    note: "F=0.025 / k=0.0575",
    color: "#4f8cc9",
    params: {
      ...snakeParams({ feed: 0.025, kill: 0.0575, seed: 5 }),
      threshold: 0.4,
      speed: 20
    }
  },
  {
    id: "lamellar-0028-00560",
    name: "ラメラー",
    note: "F=0.028 / k=0.0560",
    color: "#d09a33",
    params: {
      ...snakeParams({ feed: 0.028, kill: 0.056, seed: 5 }),
      threshold: 0.4,
      speed: 20
    }
  },
  {
    id: "pulsing-tube-0028-00635",
    name: "脈動 Tube",
    note: "F=0.028 / k=0.0635",
    color: "#8f78d8",
    params: {
      ...snakeParams({ feed: 0.028, kill: 0.0635, seed: 5 }),
      threshold: 0.4,
      speed: 20
    }
  },
  {
    id: "snake",
    name: "Snake",
    note: "F=0.058 / k=0.067",
    color: "#62716f",
    params: snakeParams({ feed: 0.058, kill: 0.067, seed: 5 })
  },
  {
    id: "snake-disc",
    name: "Snake&Disk",
    note: "F=0.074 / k=0.063 / 100³",
    color: "#7a9a6a",
    params: {
      ...snakeParams({ feed: 0.074, kill: 0.063, seed: 5 }),
      gridSize: DOMAIN_ONE_GRID,
      dx: DOMAIN_ONE_DX,
      initMode: "rodAndSphere"
    }
  }
];

export const DEFAULT_STATE = { ...PRESETS[0].params };
