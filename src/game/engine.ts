// @ts-nocheck

// Canvas globals — initialized by initEngine()
let canvas, ctx, mm;

const TILE = 40;
const COLS = 50, ROWS = 38;
const SKILL_UNLOCK_LEVELS = [1, 2, 5, 8];
let cam = { x: 0, y: 0 };

const ISO_W = 80;
const ISO_H = 40;
const WALL_H = 52;

function w2s(wx, wy) {
  const px = G.player ? G.player.x : 0, py = G.player ? G.player.y : 0;
  const rx = (wx - px) / TILE, ry = (wy - py) / TILE;
  return [canvas.width/2 + (rx - ry) * ISO_W/2, canvas.height/2 + (rx + ry) * ISO_H/2];
}
function s2w(sx, sy) {
  const px = G.player ? G.player.x : 0, py = G.player ? G.player.y : 0;
  const dx = sx - canvas.width/2, dy = sy - canvas.height/2;
  const rx = dx/ISO_W + dy/ISO_H, ry = dy/ISO_H - dx/ISO_W;
  return [px + rx * TILE, py + ry * TILE];
}

// ── Sprite system ──────────────────────────────────────────────────────────
const SP_DIRS = ['SE','S','SW','W','NW','N','NE','E'];

const SP_SZ   = 560;
const SP_AY   = 295;
const SK_AY   = 300;
const SP_TS   = 120;
const IMGS    = {};

function loadSprites() {
  if (typeof (window as any).SPRITE_DATA === 'undefined') { console.warn('sprites.js not loaded'); return; }
  Object.entries((window as any).SPRITE_DATA).forEach(([k, dataUri]) => {
    const img = new Image();
    img.src = dataUri as string;
    IMGS[k] = img;
  });
}

function isoDir(angle) {
  const deg = ((angle * 180 / Math.PI) % 360 + 360) % 360;
  return SP_DIRS[Math.round(deg / 45) % 8];
}

function drawSpr(key, sx, sy, alpha, ay) {
  const img = IMGS[key];
  if (!img || !img.complete || !img.naturalWidth) return false;
  const anchorY = ay ?? SP_AY;
  if (alpha != null) { ctx.save(); ctx.globalAlpha = alpha; }
  ctx.drawImage(img, sx - SP_SZ / 2, sy - anchorY, SP_SZ, SP_SZ);
  if (alpha != null) ctx.restore();
  return true;
}
// ──────────────────────────────────────────────────────────────────────────

let G = {
  player: null, enemies: [], projectiles: [], particles: [], lootDrops: [],
  map: null, tiles: null,
  area: 0, areaNames: ['The Blood Moor','The Cold Plains','The Dark Wood','The Underground Passage','The Catacombs'],
  kills: 0, gold: 0, tick: 0,
  selectedSkill: -1, skillCooldowns: [0,0,0,0],
  bag: [], equipped: { weapon: null, armor: null, helm: null, boots: null, shoulders: null, gloves: null, cape: null, legs: null, neck: null, ring1: null, ring2: null },
  minions: [], portalOpen: false, portalX: 0, portalY: 0, nearPortal: false, nearLoot: null,
  slashEffects: [],
  inHub: false, depth: 0, runBlessing: null,
  hubObjects: [], nearHubObject: null,
  props: [],
  persistent: { sharedStash: [], characters: {}, lastDepth: 0 }
};

const RARITIES = ['normal','magic','rare','unique'];
const RARITY_COLORS = { normal: '#c8a96e', magic: '#6060ff', rare: '#ffff00', unique: '#c87800' };

const ITEM_TEMPLATES = {
  weapon: [
    { name:'Short Sword', icon:'🗡', base:'weapon', dmg:4 },
    { name:'Battle Axe', icon:'🪓', base:'weapon', dmg:8 },
    { name:'War Staff', icon:'🪄', base:'weapon', dmg:6 },
    { name:'Broad Sword', icon:'⚔', base:'weapon', dmg:10 },
    { name:'Thunder Maul', icon:'🔨', base:'weapon', dmg:14 },
    { name:'Shadow Blade', icon:'🗡', base:'weapon', dmg:12 },
  ],
  armor: [
    { name:'Leather Armor', icon:'🛡', base:'armor', def:3 },
    { name:'Ring Mail', icon:'🛡', base:'armor', def:6 },
    { name:'Plate Mail', icon:'🛡', base:'armor', def:10 },
    { name:'Chaos Armor', icon:'🛡', base:'armor', def:14 },
  ],
  helm: [
    { name:'Skull Cap', icon:'⛑', base:'helm', def:2 },
    { name:'Iron Helm', icon:'⛑', base:'helm', def:5 },
    { name:'Crown', icon:'👑', base:'helm', def:8 },
  ],
  boots: [
    { name:'Leather Boots', icon:'👟', base:'boots', spd:10 },
    { name:'Chain Boots', icon:'👟', base:'boots', spd:5, def:2 },
    { name:'War Boots', icon:'👟', base:'boots', spd:15, def:3 },
  ],
  shoulders: [
    { name:'Leather Spaulders', icon:'🪖', base:'shoulders', def:2 },
    { name:'Iron Pauldrons',    icon:'🪖', base:'shoulders', def:5 },
    { name:'Spiked Pauldrons',  icon:'🪖', base:'shoulders', def:8 },
  ],
  gloves: [
    { name:'Cloth Gloves',   icon:'🧤', base:'gloves', def:1, dmg:1 },
    { name:'Chain Gloves',   icon:'🧤', base:'gloves', def:3, dmg:2 },
    { name:'War Gauntlets',  icon:'🧤', base:'gloves', def:5, dmg:4 },
  ],
  cape: [
    { name:'Tattered Cape',  icon:'🧣', base:'cape', def:1, spd:4 },
    { name:'Silk Cloak',     icon:'🧣', base:'cape', def:3, spd:8 },
    { name:'Shadow Mantle',  icon:'🧣', base:'cape', def:6, spd:12 },
  ],
  legs: [
    { name:'Leather Breeches', icon:'🩲', base:'legs', def:3 },
    { name:'Chain Leggings',   icon:'🩲', base:'legs', def:6 },
    { name:'War Greaves',      icon:'🩲', base:'legs', def:10 },
  ],
  neck: [
    { name:'Leather Cord',    icon:'📿', base:'neck', res:2 },
    { name:'Gold Necklace',   icon:'📿', base:'neck', res:5 },
    { name:'Arcane Pendant',  icon:'📿', base:'neck', res:8, mpBonus:20 },
  ],
  ring: [
    { name:'Copper Band',    icon:'💍', base:'ring', def:1 },
    { name:'Silver Ring',    icon:'💍', base:'ring', dmg:2 },
    { name:'Gold Ring',      icon:'💍', base:'ring', def:2, dmg:2 },
    { name:'Ruby Ring',      icon:'💍', base:'ring', dmg:4 },
    { name:'Sapphire Ring',  icon:'💍', base:'ring', mpBonus:15 },
    { name:'Skull Ring',     icon:'💍', base:'ring', dmg:6, res:3 },
  ],
  consumable: [
    { name:'Healing Potion', icon:'🧪', base:'consumable', hpRestore:50 },
    { name:'Mana Potion', icon:'💧', base:'consumable', mpRestore:40 },
  ]
};

const MAGIC_PREFIXES = ['Cruel','Sharp','Gleaming','Sturdy','Strong','Jagged','Deadly','Swift','Focused','Precise'];
const MAGIC_SUFFIXES = ['of Slaying','of the Ox','of Quickness','of the Magus','of Enduring','of Decimation','of Celerity','of Alacrity','of the Tempest'];

function rollItem(level) {
  const types = Object.keys(ITEM_TEMPLATES);
  const type = types[Math.floor(Math.random() * types.length)];
  const pool = ITEM_TEMPLATES[type];
  const base = { ...pool[Math.floor(Math.random() * pool.length)] };
  let rIdx = 0;
  const r = Math.random();
  if (r < 0.12 + level * 0.018) rIdx = 2;
  else if (r < 0.38) rIdx = 1;
  base.rarity = RARITIES[rIdx];
  base.id = Math.random().toString(36).slice(2);
  if (rIdx >= 1 && base.dmg) base.dmg += Math.floor(Math.random() * 5 * (rIdx + 1));
  if (rIdx >= 1 && base.def) base.def += Math.floor(Math.random() * 4 * (rIdx + 1));
  if (base.base !== 'consumable') {
    if (rIdx >= 1 && Math.random() < 0.45) base.critChance = Math.floor(Math.random() * 3 * rIdx) + 1;
    if (rIdx >= 1 && Math.random() < 0.35) base.critDmg    = Math.floor(Math.random() * 15 * rIdx) + 10;
    if (rIdx >= 1 && Math.random() < 0.40) base.atkSpd     = Math.floor(Math.random() * 7 * rIdx) + 2;
    if (rIdx >= 1 && Math.random() < 0.40) base.cdr        = Math.floor(Math.random() * 5 * rIdx) + 2;
  }
  if (rIdx >= 2) base.name = MAGIC_PREFIXES[Math.floor(Math.random() * MAGIC_PREFIXES.length)] + ' ' + base.name;
  if (rIdx === 3) base.name += ' ' + MAGIC_SUFFIXES[Math.floor(Math.random() * MAGIC_SUFFIXES.length)];
  return base;
}

const UNIQUE_ITEMS = [
  { name:'Soulreaper',            icon:'💀', base:'weapon', rarity:'unique', dmg:14, critChance:10, uniqueId:'soulreaper',   uniqueDesc:'On Kill: Restore 8 HP and 5 MP. Doubles with Leech Band.' },
  { name:'The Widowmaker',        icon:'⚔',  base:'weapon', rarity:'unique', dmg:5,  critChance:30, critDmg:80, uniqueId:'widowmaker',  uniqueDesc:'High crit synergy — lethal at any range.' },
  { name:'Thornmail',             icon:'🛡',  base:'armor',  rarity:'unique', def:16, uniqueId:'thornmail',   uniqueDesc:'Reflect 25% of melee damage taken back to attackers.' },
  { name:'Voidheart',             icon:'🌑',  base:'armor',  rarity:'unique', def:8,  cdr:25, uniqueId:'voidheart',   uniqueDesc:'Each skill cast restores 8 MP.' },
  { name:'Crown of Ages',         icon:'👑',  base:'helm',   rarity:'unique', def:8,  cdr:20, critChance:8, atkSpd:10, uniqueId:'crownofages', uniqueDesc:'Timeless power — all combat stats elevated.' },
  { name:'Leech Band',            icon:'💍',  base:'ring',   rarity:'unique', critChance:5, uniqueId:'leechband',   uniqueDesc:'12% of damage dealt restores HP. Doubles with Soulreaper.' },
  { name:'Echo Ring',             icon:'💍',  base:'ring',   rarity:'unique', cdr:10, uniqueId:'echoring',    uniqueDesc:'Skills echo — 2nd cast at 50% power (free). Stronger with The Pact.' },
  { name:'The Pact',              icon:'📿',  base:'neck',   rarity:'unique', critDmg:40, uniqueId:'pact',        uniqueDesc:'+60% damage dealt. Take 20% more damage. Synergy with Echo Ring.' },
  { name:'Winged Heels',          icon:'👟',  base:'boots',  rarity:'unique', spd:40, atkSpd:25, def:2, uniqueId:'wingedheels', uniqueDesc:'Speed is survival.' },
  { name:'Bloodletter Gauntlets', icon:'🧤',  base:'gloves', rarity:'unique', dmg:6,  critChance:15, uniqueId:'bloodletter',  uniqueDesc:'Crits inflict a 3-second bleed dealing 20% hit damage per tick.' },
];

function rollUnique() {
  const base = { ...UNIQUE_ITEMS[Math.floor(Math.random() * UNIQUE_ITEMS.length)] };
  base.id = Math.random().toString(36).slice(2);
  return base;
}

const CLASSES = {
  warrior: {
    name: 'Warrior', icon: '⚔', color: '#c84020',
    hp: 140, mp: 40, hpRegen: 0.6, mpRegen: 0.15,
    dmg: 8, def: 6, spd: 2.2, range: 55, attackRate: 30,
    skills: [
      { name:'Strike', icon:'⚔', key:'2', desc:'Powerful melee blow.', cd:40, mpCost:5, type:'melee', dmgMult:1.3, color:'#ff6040' },
      { name:'Whirlwind', icon:'🌀', key:'3', desc:'Spin and hit all nearby enemies.', cd:0, mpCost:18, type:'whirlwind', dmgMult:0.8, color:'#ff4000' },
      { name:'War Cry', icon:'📣', key:'4', desc:'Boost damage for 5 seconds.', cd:180, mpCost:15, type:'warcry', color:'#ffaa00' },
      { name:'Leap Attack', icon:'💥', key:'5', desc:'Leap to target, deal heavy damage.', cd:120, mpCost:18, type:'leap', dmgMult:2.5, color:'#ff2000' },
    ]
  },
  fighter: {
    name: 'Fighter', icon: '🗡', color: '#60a020',
    hp: 95, mp: 70, hpRegen: 0.3, mpRegen: 0.4,
    dmg: 6, def: 3, spd: 3.2, range: 50, attackRate: 18,
    skills: [
      { name:'Quick Strike', icon:'🗡', key:'2', desc:'Lightning-fast melee hit.', cd:25, mpCost:6, type:'melee', dmgMult:0.9, color:'#a0e040' },
      { name:'Shadow Step', icon:'👣', key:'3', desc:'Teleport to enemy and strike.', cd:60, mpCost:15, type:'shadowstep', dmgMult:2.0, color:'#80c020' },
      { name:'Blade Fury', icon:'🌪', key:'4', desc:'Rapid flurry of five quick hits.', cd:150, mpCost:25, type:'bladefury', dmgMult:0.6, color:'#60ff20' },
      { name:'Smoke Bomb', icon:'💨', key:'5', desc:'Vanish — become invulnerable briefly.', cd:240, mpCost:20, type:'smokebomb', color:'#80a060' },
    ]
  },
  knight: {
    name: 'Knight', icon: '🛡', color: '#4080e0',
    hp: 120, mp: 80, hpRegen: 0.4, mpRegen: 0.5,
    dmg: 7, def: 8, spd: 2.0, range: 60, attackRate: 38,
    skills: [
      { name:'Holy Strike', icon:'✝', key:'2', desc:'Blessed blow — extra damage to undead.', cd:40, mpCost:8, type:'holystrike', dmgMult:1.2, color:'#ffe080' },
      { name:'Blessed Hammer', icon:'🔨', key:'3', desc:'Launch spinning hammers in all directions.', cd:90, mpCost:20, type:'hammer', dmgMult:1.0, color:'#ffd040' },
      { name:'Holy Shield', icon:'🛡', key:'4', desc:'Divine protection for 5 seconds.', cd:180, mpCost:25, type:'holyshield', color:'#80c0ff' },
      { name:'Divine Smite', icon:'⚡', key:'5', desc:'Smash nearest enemy with divine force.', cd:120, mpCost:30, type:'smite', dmgMult:3.0, color:'#ffff80' },
    ]
  }
};

const ENEMY_TYPES = [
  { name:'Fallen',      icon:'👺', hp:55,   dmg:4,  spd:1.4, xp:8,   size:16, color:'#c04020', aggressive:true },
  { name:'Zombie',      icon:'🧟', hp:90,   dmg:7,  spd:0.8, xp:15,  size:18, color:'#507040', aggressive:false },
  { name:'Skeleton',    icon:'💀', hp:65,   dmg:5,  spd:1.2, xp:12,  size:16, color:'#c0c0a0', aggressive:true },
  { name:'Quill Rat',   icon:'🦔', hp:40,   dmg:3,  spd:1.8, xp:6,   size:14, color:'#806020', aggressive:true },
  { name:'Dark Lord',   icon:'😈', hp:350,  dmg:18, spd:1.0, xp:60,  size:24, color:'#8020a0', aggressive:true, boss:true },
  { name:'Bone Golem',  icon:'🗿', hp:220,  dmg:12, spd:0.7, xp:40,  size:22, color:'#a0a090', aggressive:false },
  { name:'Blood Raven', icon:'🦅', hp:170,  dmg:14, spd:1.6, xp:35,  size:20, color:'#c02020', aggressive:true, ranged:true },
  { name:'Duriel',      icon:'🐉', hp:1000, dmg:30, spd:1.3, xp:200, size:30, color:'#c08020', aggressive:true, boss:true },
];

const BLESSINGS = [
  { name:'Blood Pact',    icon:'🩸', desc:'+30% damage, −15% max HP',       dmgMult:1.3,  hpMult:0.85 },
  { name:'Iron Will',     icon:'🛡', desc:'+30% max HP',                     hpMult:1.3 },
  { name:'Swift Feet',    icon:'💨', desc:'+35% move speed',                 spdMult:1.35 },
  { name:'Arcane Surge',  icon:'✨', desc:'+40% skill damage',               skillMult:1.4 },
  { name:'Gold Fever',    icon:'💰', desc:'+100% gold drops',                goldMult:2.0 },
  { name:'Undead Bane',   icon:'💀', desc:'+60% damage to undead',           undeadMult:1.6 },
  { name:'Berserker',     icon:'⚡', desc:'+50% attack speed, −30% defense', attackRateMult:0.5, defMult:0.7 },
  { name:'Scholar',       icon:'📚', desc:'+100% XP gain',                   xpMult:2.0 },
  { name:'Regeneration',  icon:'💚', desc:'+4× HP/MP regen rate',            regenMult:4 },
  { name:'Glass Cannon',  icon:'🔮', desc:'+60% damage, −60% defense',       dmgMult:1.6, defMult:0.4 },
  { name:'Lucky',         icon:'🍀', desc:'Double item drop chance',          dropMult:2.0 },
  { name:'Titan',         icon:'🏔', desc:'+40 max HP, +5 defense',          flatHp:40, flatDef:5 },
];

const SHRINE_UPGRADES = [
  { id:'hp',    name:'Vitality',   icon:'❤',  desc:'+20 max HP per rank',     maxRank:10, baseCost:50,  costPerRank:25, apply:(p)=>{ p.maxHp += 20; p.hp = Math.min(p.hp+20, p.maxHp); } },
  { id:'dmg',   name:'Strength',   icon:'⚔',  desc:'+3 damage per rank',      maxRank:10, baseCost:60,  costPerRank:30, apply:(p)=>{ p.dmg += 3; } },
  { id:'def',   name:'Endurance',  icon:'🛡',  desc:'+2 defense per rank',     maxRank:10, baseCost:50,  costPerRank:25, apply:(p)=>{ p.def += 2; } },
  { id:'spd',   name:'Agility',    icon:'💨',  desc:'+0.3 move speed per rank',maxRank:5,  baseCost:80,  costPerRank:60, apply:(p)=>{ p.spd += 0.3; } },
  { id:'regen', name:'Resilience', icon:'💚',  desc:'+0.4 HP regen per rank',  maxRank:8,  baseCost:70,  costPerRank:40, apply:(p)=>{ p.hpRegen += 0.4; } },
];

function generateMap(areaIdx) {
  const tiles = [];
  const rooms = [];
  for (let y = 0; y < ROWS; y++) { tiles[y] = []; for (let x = 0; x < COLS; x++) tiles[y][x] = 1; }
  for (let i = 0; i < 12 + areaIdx * 2; i++) {
    const rw = 5 + Math.floor(Math.random() * 8);
    const rh = 4 + Math.floor(Math.random() * 7);
    const rx = 2 + Math.floor(Math.random() * (COLS - rw - 4));
    const ry = 2 + Math.floor(Math.random() * (ROWS - rh - 4));
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) tiles[y][x] = 0;
    rooms.push({ cx: rx + Math.floor(rw/2), cy: ry + Math.floor(rh/2) });
  }
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i], b = rooms[i+1];
    let cx = a.cx, cy = a.cy;
    while (cx !== b.cx) { tiles[cy][cx] = 0; cx += cx < b.cx ? 1 : -1; }
    while (cy !== b.cy) { tiles[cy][cx] = 0; cy += cy < b.cy ? 1 : -1; }
  }
  const lastRoom = rooms[rooms.length - 1];
  G.portalX = lastRoom.cx * TILE + TILE/2;
  G.portalY = lastRoom.cy * TILE + TILE/2;
  G.portalOpen = false;
  return { tiles, rooms };
}

function isWalkable(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  return G.map.tiles[ty][tx] === 0;
}

function findStart(map) {
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (map.tiles[y][x] === 0) return { x: x * TILE + TILE/2, y: y * TILE + TILE/2 };
  return { x: TILE + TILE/2, y: TILE + TILE/2 };
}

function spawnEnemies(map, areaIdx) {
  const enemies = [];
  const depth = G.depth || 1;
  const count = Math.min(80, (20 + areaIdx * 8) + (depth - 1) * 6);
  const eligibleTypes = ENEMY_TYPES.filter(e => !e.boss).slice(0, 3 + areaIdx);
  for (let i = 0; i < count; i++) {
    let tx, ty;
    for (let tries = 0; tries < 50; tries++) { tx = 2 + Math.floor(Math.random() * (COLS - 4)); ty = 2 + Math.floor(Math.random() * (ROWS - 4)); if (isWalkable(tx, ty)) break; }
    const tmpl = eligibleTypes[Math.floor(Math.random() * eligibleTypes.length)];
    const scaleMult = 1 + areaIdx * 0.5 + (depth - 1) * 0.45;
    const hp = Math.round(tmpl.hp * scaleMult);
    enemies.push({ ...tmpl, x: tx * TILE + TILE/2, y: ty * TILE + TILE/2, hp, maxHp: hp, dmg: Math.round(tmpl.dmg * (1 + areaIdx * 0.4 + (depth-1)*0.4)), xp: Math.round(tmpl.xp * (1 + areaIdx * 0.2 + (depth-1)*0.15)), id: Math.random().toString(36).slice(2), state: 'idle', attackCd: 0, frozen: 0, poisoned: 0, poisonTimer: 0, bleedDmg: 0, bleedTimer: 0 });
  }
  const bossPool = ENEMY_TYPES.filter(e => e.boss);
  const boss = { ...bossPool[Math.min(Math.max(areaIdx - 1, 0), bossPool.length - 1)] };
  const lr = map.rooms[map.rooms.length - 1];
  const bossHp = Math.round(boss.hp * (1 + areaIdx * 0.6 + (depth-1)*0.5));
  enemies.push({ ...boss, x: lr.cx * TILE, y: lr.cy * TILE, hp: bossHp, maxHp: bossHp, dmg: Math.round(boss.dmg * (1 + areaIdx * 0.3 + (depth-1)*0.3)), id: Math.random().toString(36).slice(2), state: 'idle', attackCd: 0, frozen: 0, poisoned: 0, poisonTimer: 0, bleedDmg: 0, bleedTimer: 0 });
  return enemies;
}

function createPlayer(cls) {
  const tmpl = CLASSES[cls];
  return { x: 0, y: 0, cls, ...tmpl, maxHp: tmpl.hp, maxMp: tmpl.mp, level: 1, xp: 0, xpNext: 300, targetX: null, targetY: null, moving: false, attackCd: 0, buffDmg: 0, buffTimer: 0, shieldTimer: 0, invincible: 0, attackTarget: null, facingAngle: 0, skillPoints: 0, skillRanks: [1, 0, 0, 0] };
}

function selectClass(cls) {
  document.getElementById('overlay').style.display = 'none';
  loadPersistent();
  G.player = createPlayer(cls);
  G.kills = 0; G.gold = 0; G.bag = [];
  G.equipped = { weapon: null, armor: null, helm: null, boots: null };
  G.minions = [];
  const cp = getCharPersist();
  SHRINE_UPGRADES.forEach(upg => {
    const rank = cp.upgrades[upg.id] || 0;
    for (let i = 0; i < rank; i++) upg.apply(G.player);
  });
  document.getElementById('char-name').textContent = CLASSES[cls].name;
  buildSkillBar();
  loadHub();
  requestAnimationFrame(gameLoop);
}

function loadArea(idx, fresh) {
  G.area = idx;
  G.map = generateMap(idx);
  G.enemies = spawnEnemies(G.map, idx);
  G.props = spawnDungeonProps(G.map);
  G.projectiles = []; G.particles = []; G.lootDrops = []; G.minions = [];
  const start = findStart(G.map);
  G.player.x = start.x; G.player.y = start.y;
  cam.x = G.player.x - canvas.width / 2;
  cam.y = G.player.y - canvas.height / 2;
  document.getElementById('area-name').textContent = G.areaNames[idx] || 'Deep Dungeons';
  showAreaMsg(G.areaNames[idx] || 'Deep Dungeons');
  if (idx === 4) addMsg('You feel a powerful presence...', '#ff4444');
  updateEnemyCounter();
}

function showAreaMsg(name) {
  const el = document.getElementById('area-msg');
  el.textContent = name; el.style.opacity = 1;
  setTimeout(() => el.style.opacity = 0, 2000);
}

function getPlayerStats() {
  const eq = G.equipped || {};
  const items = Object.values(eq).filter(Boolean);
  return {
    critChance: Math.min(75, 5  + items.reduce((s,i) => s + (i.critChance || 0), 0)),
    critDmg:    150 + items.reduce((s,i) => s + (i.critDmg   || 0), 0),
    atkSpd:     Math.min(75, items.reduce((s,i) => s + (i.atkSpd    || 0), 0)),
    cdr:        Math.min(75, items.reduce((s,i) => s + (i.cdr       || 0), 0)),
  };
}

function getEffectiveAttackRate() {
  const p = G.player;
  const { atkSpd } = getPlayerStats();
  return Math.max(6, Math.round(p.attackRate / (1 + atkSpd / 100)));
}

function buildSkillBar() {
  const bar = document.getElementById('skills-bar');
  bar.innerHTML = '';
  const basicBtn = document.createElement('div');
  basicBtn.id = 'skbtn-basic';
  basicBtn.className = 'skill-btn' + (G.selectedSkill === -1 ? ' active' : '');
  basicBtn.innerHTML = `<span style="font-size:20px;">⚔</span><span class="skill-key">1</span>`;
  basicBtn.title = 'Basic Attack [1]: Standard swing. Uses attack speed.';
  basicBtn.onclick = () => { G.selectedSkill = -1; updateSkillBar(); };
  bar.appendChild(basicBtn);
  const ranks = G.player.skillRanks || [1,0,0,0];
  CLASSES[G.player.cls].skills.forEach((sk, i) => {
    const rank = ranks[i] || 0;
    const locked = rank === 0;
    const btn = document.createElement('div');
    btn.className = 'skill-btn' + (!locked && i === G.selectedSkill ? ' active' : '') + (locked ? ' locked' : '');
    btn.id = 'skbtn-' + i;
    const pips = locked ? '' : `<span class="skill-rank-pip">${'●'.repeat(rank)}${'○'.repeat(3-rank)}</span>`;
    btn.innerHTML = `<span style="font-size:20px;${locked?'filter:grayscale(1)':''}">${locked?'🔒':sk.icon}</span><span class="skill-key">${sk.key}</span>${pips}`;
    btn.title = locked ? `${sk.name} — Locked (open Skill Tree [T])` : `${sk.name} [Rank ${rank}]: ${sk.desc}`;
    btn.onclick = () => { if (locked) { showSkillTree(); return; } G.selectedSkill = i; updateSkillBar(); };
    bar.appendChild(btn);
  });
  updateSkillPtsBadge();
}

function updateSkillBar() {
  const ranks = G.player.skillRanks || [1,0,0,0];
  const basicBtn = document.getElementById('skbtn-basic');
  if (basicBtn) basicBtn.className = 'skill-btn' + (G.selectedSkill === -1 ? ' active' : '');
  CLASSES[G.player.cls].skills.forEach((sk, i) => {
    const btn = document.getElementById('skbtn-' + i);
    if (!btn) return;
    const rank = ranks[i] || 0;
    const locked = rank === 0;
    btn.className = 'skill-btn' + (!locked && i === G.selectedSkill ? ' active' : '') + (locked ? ' locked' : '');
    let cdEl = btn.querySelector('.skill-cd');
    if (!locked && G.skillCooldowns[i] > 0) {
      if (!cdEl) { cdEl = document.createElement('div'); cdEl.className = 'skill-cd'; btn.appendChild(cdEl); }
      cdEl.textContent = Math.ceil(G.skillCooldowns[i] / 60);
    } else if (cdEl) cdEl.remove();
  });
}

function updateSkillPtsBadge() {
  const pts = G.player ? (G.player.skillPoints || 0) : 0;
  const el = document.getElementById('skill-pts-badge');
  if (el) {
    el.textContent = pts + ' pt' + (pts !== 1 ? 's' : '');
    el.style.color = pts > 0 ? '#ffd700' : '#666';
    el.style.borderColor = pts > 0 ? '#8b5e20' : '#3a2a0e';
  }
}

function showSkillTree() {
  closeAllPanels();
  document.getElementById('skill-tree-panel').classList.add('open');
  renderSkillTree();
}

function renderSkillTree() {
  const p = G.player;
  if (!p) return;
  const ranks = p.skillRanks || [1,0,0,0];
  const pts = p.skillPoints || 0;
  document.getElementById('sk-pts-label').textContent = pts + ' Skill Point' + (pts !== 1 ? 's' : '') + ' available';
  const list = document.getElementById('sk-tree-list');
  list.innerHTML = '';
  CLASSES[p.cls].skills.forEach((sk, i) => {
    const rank = ranks[i] || 0;
    const locked = rank === 0;
    const maxRank = 3;
    const prevOk = i === 0 || (ranks[i-1] || 0) >= 1;
    const levelOk = p.level >= SKILL_UNLOCK_LEVELS[i];
    const canUnlock  = locked && prevOk && levelOk && pts >= 1;
    const canUpgrade = !locked && rank < maxRank && pts >= 1;
    const row = document.createElement('div');
    row.className = 'sk-tree-row' + (locked ? ' sk-locked' : '');
    const rankDots = locked ? '○○○' : ('●'.repeat(rank) + '○'.repeat(maxRank - rank));
    const rankBonusDesc = rank < maxRank
      ? (rank === 0 ? '' : rank === 1 ? 'R2: +35% dmg, -20% CD' : 'R3: +75% dmg, -35% CD')
      : 'MAX';
    const reqParts = [];
    if (locked) {
      if (!levelOk) reqParts.push('Level ' + SKILL_UNLOCK_LEVELS[i]);
      if (!prevOk)  reqParts.push(CLASSES[p.cls].skills[i-1].name + ' unlocked');
    }
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:22px;${locked?'filter:grayscale(1);opacity:0.5':''}">${sk.icon}</span>
        <div style="flex:1">
          <div style="font-size:13px;color:${locked?'#666':'#c8a96e'};font-family:Georgia,serif;">${sk.name}</div>
          <div style="font-size:10px;color:#ffd700;letter-spacing:2px;">${rankDots}</div>
        </div>
        <div style="font-size:10px;color:#888;text-align:right;">${locked?'LOCKED':'Rank '+rank+'/'+maxRank}</div>
      </div>
      <div style="font-size:11px;color:#666;margin-bottom:4px;">${sk.desc}</div>
      ${reqParts.length ? `<div style="font-size:10px;color:#c06020;margin-bottom:4px;">Requires: ${reqParts.join(', ')}</div>` : ''}
      ${!locked && rank < maxRank ? `<div style="font-size:10px;color:#9a7040;margin-bottom:4px;">${rankBonusDesc}</div>` : ''}
    `;
    if (locked) {
      const btn = document.createElement('button');
      btn.className = 'sk-tree-btn';
      btn.textContent = canUnlock ? 'Unlock (1 pt)' : (pts < 1 ? 'No skill points' : 'Requirements not met');
      btn.disabled = !canUnlock;
      btn.onclick = () => spendSkillPoint(i);
      row.appendChild(btn);
    } else if (rank < maxRank) {
      const btn = document.createElement('button');
      btn.className = 'sk-tree-btn';
      btn.textContent = canUpgrade ? `Upgrade to Rank ${rank+1} (1 pt)` : 'No skill points';
      btn.disabled = !canUpgrade;
      btn.onclick = () => spendSkillPoint(i);
      row.appendChild(btn);
    } else {
      const maxEl = document.createElement('div');
      maxEl.style.cssText = 'font-size:11px;color:#ffd700;text-align:center;padding:2px 0;';
      maxEl.textContent = '✦ Max Rank';
      row.appendChild(maxEl);
    }
    list.appendChild(row);
  });
}

function spendSkillPoint(idx) {
  const p = G.player;
  if (!p || (p.skillPoints || 0) < 1) return;
  const ranks = p.skillRanks;
  const rank = ranks[idx] || 0;
  if (rank >= 3) return;
  if (rank === 0) {
    if (idx > 0 && (ranks[idx-1] || 0) === 0) return;
    if (p.level < SKILL_UNLOCK_LEVELS[idx]) return;
  }
  p.skillPoints--;
  p.skillRanks[idx] = rank + 1;
  const sk = CLASSES[p.cls].skills[idx];
  addMsg(`${sk.name} ${rank === 0 ? 'unlocked' : 'upgraded to Rank ' + p.skillRanks[idx]}!`, '#ffd700');
  buildSkillBar();
  renderSkillTree();
}

let mouseWorld = { x: 0, y: 0 };
let keys = {};
let isMouseDown = false;

function handleLeftMouse(wx, wy) {
  if (!G.player) return;
  const hitEnemy = G.enemies.find(en => !en.dead && dist2({x:wx,y:wy}, en) < (en.size + 10) ** 2);
  if (hitEnemy) {
    G.player.attackTarget = hitEnemy.id;
    G.player.moving = true;
    return;
  }
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  if (!isWalkable(tx, ty)) return;
  G.player.attackTarget = null;
  G.player.targetX = wx; G.player.targetY = wy; G.player.moving = true;
}

function toggleInventory() {
  const p = document.getElementById('inv-panel');
  p.classList.toggle('open');
  if (p.classList.contains('open')) renderInventory();
}

function usePotionBelt(slot) {
  if (!G.player) return;
  const type = slot === 0 ? 'hpRestore' : 'mpRestore';
  const potion = G.bag.find(i => i[type]);
  if (potion) { equipOrUseItem(potion); updatePotionBelt(); }
  else addMsg(slot === 0 ? 'No healing potions!' : 'No mana potions!', '#888');
}

function updatePotionBelt() {
  if (!G.player) return;
  const hpPots = G.bag.filter(i => i.hpRestore);
  const mpPots = G.bag.filter(i => i.mpRestore);
  document.getElementById('pbelt-count-0').textContent = hpPots.length || '';
  document.getElementById('pbelt-count-1').textContent = mpPots.length || '';
  document.getElementById('pbelt-0').style.borderColor = hpPots.length ? '#5c3d1e' : '#2a1a0a';
  document.getElementById('pbelt-1').style.borderColor = mpPots.length ? '#5c3d1e' : '#2a1a0a';
}

function renderInventory() {
  const eq = G.equipped;
  const setText = (id, item, slotKey) => {
    const el = document.getElementById(id);
    if (item) {
      el.textContent = item.name;
      el.className = 'slot-item rarity-' + item.rarity + ' equipped-active';
      el.title = 'Click to unequip';
      el.onmouseenter = (ev) => showTooltip(ev, item);
      el.onmouseleave = hideTooltip;
      el.onclick = () => unequipItem(slotKey);
    } else {
      el.textContent = 'None';
      el.className = 'slot-item';
      el.title = '';
      el.onmouseenter = null; el.onmouseleave = null; el.onclick = null;
    }
  };
  setText('eq-weapon',    eq.weapon,    'weapon');
  setText('eq-armor',     eq.armor,     'armor');
  setText('eq-helm',      eq.helm,      'helm');
  setText('eq-boots',     eq.boots,     'boots');
  setText('eq-shoulders', eq.shoulders, 'shoulders');
  setText('eq-gloves',    eq.gloves,    'gloves');
  setText('eq-cape',      eq.cape,      'cape');
  setText('eq-legs',      eq.legs,      'legs');
  setText('eq-neck',      eq.neck,      'neck');
  setText('eq-ring1',     eq.ring1,     'ring1');
  setText('eq-ring2',     eq.ring2,     'ring2');
  const bagEl = document.getElementById('bag');
  bagEl.innerHTML = '';
  G.bag.forEach(item => {
    const div = document.createElement('div');
    div.className = 'inv-item';
    div.innerHTML = `<span class="item-icon">${item.icon}</span><span class="item-name rarity-${item.rarity}">${item.name}</span>`;
    div.onclick = () => equipOrUseItem(item);
    div.onmouseenter = (ev) => showTooltip(ev, item);
    div.onmouseleave = hideTooltip;
    div.oncontextmenu = (e) => {
      e.preventDefault(); hideTooltip();
      G.bag = G.bag.filter(i => i.id !== item.id);
      addMsg(`Dropped: ${item.name}`, '#666');
      renderInventory();
    };
    bagEl.appendChild(div);
  });
  const totalDmg = G.player.dmg + (eq.weapon ? (eq.weapon.dmg || 0) : 0) + (eq.gloves ? (eq.gloves.dmg || 0) : 0) + (eq.ring1 ? (eq.ring1.dmg || 0) : 0) + (eq.ring2 ? (eq.ring2.dmg || 0) : 0) + G.player.buffDmg;
  const totalDef = G.player.def + ['armor','helm','boots','shoulders','gloves','cape','legs','ring1','ring2'].reduce((s,k) => s + (eq[k] ? (eq[k].def || 0) : 0), 0);
  const totalSpd = 100 + (eq.boots ? (eq.boots.spd || 0) : 0) + (eq.cape ? (eq.cape.spd || 0) : 0);
  const stats = getPlayerStats();
  document.getElementById('stat-dmg').textContent = totalDmg;
  document.getElementById('stat-def').textContent = totalDef;
  document.getElementById('stat-spd').textContent = totalSpd + '%';
  document.getElementById('stat-crit').textContent = stats.critChance + '%';
  document.getElementById('stat-critdmg').textContent = stats.critDmg + '%';
  document.getElementById('stat-atkspd').textContent = stats.atkSpd + '%';
  document.getElementById('stat-cdr').textContent = stats.cdr + '%';
}

function showTooltip(e, item) {
  const tt = document.getElementById('tooltip');
  let html = `<div style="color:${RARITY_COLORS[item.rarity]};font-weight:bold;">${item.icon} ${item.name}</div>`;
  html += `<div style="color:#888;font-size:10px;text-transform:capitalize;">${item.rarity} ${item.base}</div>`;
  if (item.dmg) html += `<div style="color:#c8a96e;">Damage: +${item.dmg}</div>`;
  if (item.def) html += `<div style="color:#c8a96e;">Defense: +${item.def}</div>`;
  if (item.spd) html += `<div style="color:#c8a96e;">Speed: +${item.spd}%</div>`;
  if (item.res) html += `<div style="color:#60c0ff;">Resistance: +${item.res}</div>`;
  if (item.mpBonus) html += `<div style="color:#8080ff;">Mana: +${item.mpBonus}</div>`;
  if (item.critChance) html += `<div style="color:#ff9040;">Crit Chance: +${item.critChance}%</div>`;
  if (item.critDmg)    html += `<div style="color:#ff6020;">Crit Damage: +${item.critDmg}%</div>`;
  if (item.atkSpd)     html += `<div style="color:#40e0ff;">Atk Speed: +${item.atkSpd}%</div>`;
  if (item.cdr)        html += `<div style="color:#c080ff;">CD Reduction: +${item.cdr}%</div>`;
  if (item.hpRestore) html += `<div style="color:#44ff44;">Restores ${item.hpRestore} HP</div>`;
  if (item.mpRestore) html += `<div style="color:#6060ff;">Restores ${item.mpRestore} MP</div>`;
  if (item.uniqueDesc) html += `<div style="color:#ff9030;margin-top:4px;font-style:italic;font-size:10px;">${item.uniqueDesc}</div>`;
  html += `<div style="color:#888;margin-top:4px;font-size:10px;">Click to equip/use</div>`;
  tt.innerHTML = html; tt.style.display = 'block';
  tt.style.left = (e.clientX + 10) + 'px'; tt.style.top = (e.clientY - 40) + 'px';
}
function hideTooltip() { document.getElementById('tooltip').style.display = 'none'; }

function unequipItem(slotKey) {
  hideTooltip();
  const item = G.equipped[slotKey];
  if (!item) return;
  if (G.bag.length >= 20) { addMsg('Inventory full — cannot unequip!', '#ff4444'); return; }
  G.bag.push(item);
  G.equipped[slotKey] = null;
  addMsg(`Unequipped: ${item.name}`, '#888');
  renderInventory(); updatePotionBelt();
}

function getSellPrice(item) {
  const rarityMult = { normal: 1, magic: 3.5, rare: 8, unique: 25 };
  return item.price
    ? Math.max(1, Math.round(item.price * 0.35))
    : Math.round(10 * (rarityMult[item.rarity] || 1));
}

function sellBagItem(id) {
  hideTooltip();
  const item = G.bag.find(i => i.id === id);
  if (!item) return;
  const price = getSellPrice(item);
  G.bag = G.bag.filter(i => i.id !== id);
  G.gold += price;
  document.getElementById('gold-display').textContent = '⬡ ' + G.gold + ' Gold';
  addMsg(`Sold ${item.name} for ⬡${price}`, '#ffd700');
  renderShop(); updatePotionBelt();
}

function equipOrUseItem(item) {
  hideTooltip();
  if (item.base === 'consumable') {
    if (item.hpRestore) { G.player.hp = Math.min(G.player.maxHp, G.player.hp + item.hpRestore); addMsg(`Used ${item.name}: +${item.hpRestore} HP`, '#44ff44'); }
    if (item.mpRestore) { G.player.mp = Math.min(G.player.maxMp, G.player.mp + item.mpRestore); addMsg(`Used ${item.name}: +${item.mpRestore} MP`, '#6060ff'); }
    G.bag = G.bag.filter(i => i.id !== item.id);
  } else if (item.base === 'ring') {
    if (!G.equipped.ring1) { G.equipped.ring1 = item; }
    else if (!G.equipped.ring2) { G.equipped.ring2 = item; }
    else { G.bag.push(G.equipped.ring1); G.equipped.ring1 = item; }
    G.bag = G.bag.filter(i => i.id !== item.id);
    addMsg(`Equipped: ${item.name}`, RARITY_COLORS[item.rarity]);
  } else {
    if (G.equipped[item.base]) G.bag.push(G.equipped[item.base]);
    G.equipped[item.base] = item;
    G.bag = G.bag.filter(i => i.id !== item.id);
    addMsg(`Equipped: ${item.name}`, RARITY_COLORS[item.rarity]);
  }
  renderInventory();
  updatePotionBelt();
}

function useSkill(idx, wx, wy) {
  if (!G.player) return;
  const p = G.player;
  if (idx === -1) {
    if (p.attackCd > 0) return;
    const eq = G.equipped;
    const baseDmg = p.dmg + (eq.weapon?eq.weapon.dmg||0:0) + (eq.gloves?eq.gloves.dmg||0:0) + (eq.ring1?eq.ring1.dmg||0:0) + (eq.ring2?eq.ring2.dmg||0:0) + p.buffDmg;
    p.facingAngle = Math.atan2(wy - p.y, wx - p.x);
    meleeAttack(p.x, p.y, p.range || 55, baseDmg * 0.8, p.color);
    p.attackCd = getEffectiveAttackRate();
    return;
  }
  if (G.skillCooldowns[idx] > 0) return;
  const rank = (p.skillRanks || [1,0,0,0])[idx] || 0;
  if (rank === 0) { addMsg('Skill locked — open Skill Tree [T]', '#888'); return; }
  const sk = CLASSES[p.cls].skills[idx];
  const mpCost = sk.mpCost || 0;
  if (p.mp < mpCost) { addMsg('Not enough mana!', '#6060ff'); return; }
  p.mp -= mpCost;
  const rankCdMult  = [1.0, 1.0, 0.80, 0.65][rank];
  const rankDmgMult = [1.0, 1.0, 1.35, 1.75][rank];
  const { cdr } = getPlayerStats();
  G.skillCooldowns[idx] = Math.round(sk.cd * 60 * rankCdMult * (1 - cdr / 100));
  const dx = wx - p.x, dy = wy - p.y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const nx = dx/dist, ny = dy/dist;
  const getDmg = () => (p.dmg + (G.equipped.weapon ? (G.equipped.weapon.dmg || 0) : 0) + (G.equipped.gloves ? (G.equipped.gloves.dmg || 0) : 0) + (G.equipped.ring1 ? (G.equipped.ring1.dmg || 0) : 0) + (G.equipped.ring2 ? (G.equipped.ring2.dmg || 0) : 0) + p.buffDmg) * (sk.dmgMult || 1) * rankDmgMult * (1 + (p.level - 1) * 0.1);

  switch(sk.type) {
    case 'melee': meleeAttack(p.x, p.y, p.range || 55, getDmg(), sk.color); break;
    case 'whirlwind':
      for (let a = 0; a < Math.PI * 2; a += 0.5) setTimeout(() => meleeAttack(p.x, p.y, 80, getDmg() * 0.6, sk.color), a * 80);
      spawnParticles(p.x, p.y, sk.color, 20); break;
    case 'warcry': p.buffDmg = Math.round(p.dmg * 0.5); p.buffTimer = 300; addMsg('War Cry! +50% damage for 5s', '#ffaa00'); spawnParticles(p.x, p.y, '#ffaa00', 15); break;
    case 'leap': p.x = Math.min(Math.max(wx, TILE), (COLS-1)*TILE); p.y = Math.min(Math.max(wy, TILE), (ROWS-1)*TILE); meleeAttack(p.x, p.y, 80, getDmg(), sk.color); spawnParticles(p.x, p.y, sk.color, 20); break;
    case 'chargedbolt':
      for (let i = -2; i <= 2; i++) G.projectiles.push({ x: p.x, y: p.y, vx: (nx + i * 0.3) * 5, vy: (ny + i * 0.3) * 5, dmg: getDmg(), color: sk.color, size: 5, life: 80, owner: 'player', type: 'bolt' });
      break;
    case 'fireball': G.projectiles.push({ x: p.x, y: p.y, vx: nx * 7, vy: ny * 7, dmg: getDmg(), color: sk.color, size: 8, life: 120, owner: 'player', type: 'fireball', explode: true }); break;
    case 'frostnova':
      G.enemies.forEach(en => { if (!en.dead && dist2(p, en) < 120*120) { en.frozen = 180; dealDamage(en, getDmg() * 0.5, '#80d0ff'); } });
      spawnParticles(p.x, p.y, sk.color, 25); break;
    case 'blizzard':
      for (let i = 0; i < 12; i++) setTimeout(() => G.projectiles.push({ x: wx+(Math.random()-0.5)*160, y: wy-200+(Math.random()-0.5)*40, vx: 0, vy: 4, dmg: getDmg()*0.8, color: sk.color, size: 6, life: 80, owner: 'player', type: 'bolt' }), i * 150);
      break;
    case 'bonespear': G.projectiles.push({ x: p.x, y: p.y, vx: nx*8, vy: ny*8, dmg: getDmg(), color: sk.color, size: 5, life: 200, owner: 'player', type: 'pierce', pierced: new Set() }); break;
    case 'summon':
      if (G.minions.length < 5 + p.level) { G.minions.push({ x: p.x+(Math.random()-0.5)*60, y: p.y+(Math.random()-0.5)*60, hp: 40+p.level*10, maxHp: 40+p.level*10, dmg: getDmg()*0.7, spd: 1.5, size: 14, color: '#80a080', attackCd: 0, id: Math.random().toString(36).slice(2) }); addMsg(`Skeleton raised! (${G.minions.length} minions)`, '#80a080'); }
      else addMsg('Max minions reached!', '#888'); break;
    case 'poisonnova':
      G.enemies.forEach(en => { if (!en.dead && dist2(p, en) < 150*150) { en.poisoned = getDmg()*0.15; en.poisonTimer = 300; dealDamage(en, getDmg()*0.3, '#40c040'); } });
      spawnParticles(p.x, p.y, '#40c040', 30); break;
    case 'golem': G.minions.push({ x: wx, y: wy, hp: 200+p.level*20, maxHp: 200+p.level*20, dmg: getDmg()*1.5, spd: 1.0, size: 24, color: '#808080', attackCd: 0, id: Math.random().toString(36).slice(2), isGolem: true }); addMsg('Iron Golem summoned!', '#808080'); break;
    case 'shadowstep': {
      const st = G.enemies.filter(e=>!e.dead&&!e.dying).sort((a,b)=>dist2({x:wx,y:wy},a)-dist2({x:wx,y:wy},b))[0];
      if (st) { p.x = st.x - 25; p.y = st.y - 25; } else { p.x = Math.min(Math.max(wx,TILE),(COLS-1)*TILE); p.y = Math.min(Math.max(wy,TILE),(ROWS-1)*TILE); }
      meleeAttack(p.x, p.y, 70, getDmg(), sk.color); spawnParticles(p.x, p.y, sk.color, 25); break;
    }
    case 'bladefury':
      for (let i=0;i<5;i++) setTimeout(()=>meleeAttack(p.x,p.y,p.range,getDmg(),sk.color),i*100);
      spawnParticles(p.x,p.y,sk.color,15); break;
    case 'smokebomb':
      p.invincible=240; spawnParticles(p.x,p.y,'#888888',40);
      addMsg('Smoke Bomb! 4s invincibility!','#80a060'); break;
    case 'holystrike':
      G.enemies.forEach(en=>{if(!en.dead&&!en.dying&&dist2(p,en)<(p.range||60)**2){const undead=en.name==='Skeleton'||en.name==='Zombie'||en.name==='Bone Golem';dealDamage(en,getDmg()*(undead?1.6:1),sk.color,p.x,p.y);}});
      spawnParticles(p.x,p.y,sk.color,10); break;
    case 'hammer':
      for(let i=0;i<8;i++){const a=i*Math.PI/4;G.projectiles.push({x:p.x,y:p.y,vx:Math.cos(a)*5,vy:Math.sin(a)*5,dmg:getDmg(),color:sk.color,size:8,life:35,owner:'player',type:'bolt'});}
      spawnParticles(p.x,p.y,sk.color,15); break;
    case 'holyshield':
      p.shieldTimer=300; p.invincible=300;
      spawnParticles(p.x,p.y,'#80c0ff',20); addMsg('Holy Shield! 5s divine protection!','#80c0ff'); break;
    case 'smite': {
      const sm=G.enemies.filter(e=>!e.dead&&!e.dying).sort((a,b)=>dist2({x:wx,y:wy},a)-dist2({x:wx,y:wy},b))[0];
      if(sm){dealDamage(sm,getDmg(),sk.color,p.x,p.y);sm.frozen=90;spawnParticles(sm.x,sm.y,sk.color,30);}
      break;
    }
  }
  if (G.equipped) {
    const allEq = Object.values(G.equipped).filter(Boolean);
    if (allEq.some(i => i.uniqueId === 'voidheart')) p.mp = Math.min(p.maxMp, p.mp + 8);
    if (allEq.some(i => i.uniqueId === 'echoring')) {
      const hasPact = allEq.some(i => i.uniqueId === 'pact');
      const echoPower = hasPact ? 0.75 : 0.5;
      const echoRange = (p.range || 55) * 1.3;
      setTimeout(() => {
        if (G.player && !G.inHub) meleeAttack(G.player.x, G.player.y, echoRange, getDmg() * echoPower, '#c0c0ff');
      }, 350);
    }
  }
}

function meleeAttack(ax, ay, range, dmg, color) {
  G.enemies.forEach(en => { if (!en.dead && dist2({x:ax,y:ay}, en) < range*range) dealDamage(en, dmg, color); });
  spawnParticles(ax+(Math.random()-0.5)*30, ay+(Math.random()-0.5)*30, color, 6);
  if (G.player) {
    const angle = G.player.facingAngle;
    G.slashEffects.push({ x: ax+Math.cos(angle)*25, y: ay+Math.sin(angle)*25, life: 10, maxLife: 10, color, angle });
  }
}

function dealDamage(en, dmgRaw, color, attackerX, attackerY) {
  const allEq = G.equipped ? Object.values(G.equipped).filter(Boolean) : [];
  if (allEq.some(i => i.uniqueId === 'pact')) dmgRaw = Math.round(dmgRaw * 1.6);
  const { critChance, critDmg } = G.player ? getPlayerStats() : { critChance: 5, critDmg: 150 };
  const isCrit = Math.random() * 100 < critChance;
  const dmg = Math.max(1, Math.round(dmgRaw * (isCrit ? critDmg / 100 : 1)));
  if (isCrit && allEq.some(i => i.uniqueId === 'bloodletter')) {
    en.bleedDmg = Math.max(1, Math.round(dmgRaw * 0.2));
    en.bleedTimer = 180;
  }
  en.hp -= dmg;
  spawnFloatingText(en.x, en.y, isCrit ? '⚡'+dmg : dmg, isCrit ? 'crit' : '');
  spawnParticles(en.x, en.y, color || '#ff4444', isCrit ? 8 : 4);
  if (G.player && allEq.some(i => i.uniqueId === 'leechband')) {
    const heal = Math.max(1, Math.round(dmg * 0.12));
    G.player.hp = Math.min(G.player.maxHp, G.player.hp + heal);
  }
  if (attackerX !== undefined && !en.dead) {
    const kdx = en.x - attackerX, kdy = en.y - attackerY;
    const kd = Math.sqrt(kdx*kdx + kdy*kdy) || 1;
    en.x += (kdx/kd) * (isCrit ? 14 : 7);
    en.y += (kdy/kd) * (isCrit ? 14 : 7);
  }
  if (en.hp <= 0) killEnemy(en);
}

function dist2(a, b) { return (a.x-b.x)**2 + (a.y-b.y)**2; }

function killEnemy(en) {
  if (en.dead || en.dying) return;
  en.dying = true;
  en.deathFrame = 0;
  en.deathTick = 0;
  en.deathDir = G.player ? isoDir(Math.atan2(G.player.y - en.y, G.player.x - en.x)) : 'S';
  G.kills++;
  giveXP(en.xp); dropLoot(en);
  if (G.player && G.equipped) {
    const allEq = Object.values(G.equipped).filter(Boolean);
    if (allEq.some(i => i.uniqueId === 'soulreaper')) {
      const hasLeech = allEq.some(i => i.uniqueId === 'leechband');
      const mult = hasLeech ? 2 : 1;
      G.player.hp = Math.min(G.player.maxHp, G.player.hp + 8 * mult);
      G.player.mp = Math.min(G.player.maxMp, G.player.mp + 5 * mult);
    }
  }
  if (en.boss) { addMsg(`${en.name} has been slain!`, '#ffd700'); spawnParticles(en.x, en.y, '#ffd700', 40); }
  updateEnemyCounter();
  if (!G.inHub && !G.portalOpen && G.enemies.every(e => e.dead || e.dying)) {
    G.portalOpen = true;
    addMsg('Floor cleared! The portal opens...', '#c060ff');
    spawnParticles(G.portalX, G.portalY, '#c060ff', 35);
  }
}

function updateEnemyCounter() {
  const el = document.getElementById('kill-count');
  if (!el) return;
  if (!G.inHub && G.map) {
    const alive = G.enemies.filter(e => !e.dead && !e.dying).length;
    el.textContent = alive === 0 ? 'Floor cleared!' : alive + ' enemies remain';
  } else {
    el.textContent = 'Kills: ' + G.kills;
  }
}

function giveXP(amt) {
  const p = G.player;
  const xpMult = G.runBlessing?.xpMult || 1;
  amt = Math.round(amt * 1.5 * xpMult);
  p.xp += amt;
  spawnFloatingText(p.x, p.y - 20, '+'+amt+' XP', 'exp');
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext; p.level++;
    p.xpNext = Math.round(p.xpNext * 1.8);
    p.maxHp = Math.round(p.maxHp * 1.1 + 10); p.hp = p.maxHp;
    p.maxMp = Math.round(p.maxMp * 1.1 + 5); p.mp = p.maxMp;
    p.dmg += 2;
    p.skillPoints = (p.skillPoints || 0) + 1;
    addMsg(`Level Up! Level ${p.level} — +1 Skill Point [T]`, '#ffd700');
    spawnParticles(p.x, p.y, '#ffd700', 25);
    document.getElementById('char-level').textContent = 'Level ' + p.level;
    updateSkillPtsBadge();
    if (document.getElementById('skill-tree-panel').classList.contains('open')) renderSkillTree();
  }
}

function dropLoot(en) {
  const depth = G.depth || 1;
  const depthMult = 1 + (depth - 1) * 0.3;
  const dropChance = G.runBlessing?.dropMult || 1;
  const goldMult = (G.runBlessing?.goldMult || 1) * depthMult;
  const r = Math.random();
  const drops = [];
  if (r < (0.35 + (en.boss ? 0.5 : 0)) * dropChance) drops.push(rollItem(depth * 2 + G.player.level));
  if (r < 0.6 || en.boss) { const g = Math.round((5+Math.random()*20)*goldMult*(en.boss?5:1)); drops.push({type:'gold',amount:g}); }
  if (en.boss) drops.push(rollItem(depth * 2 + G.player.level + 2));
  if (Math.random() < (en.boss ? 0.05 : 0.005)) drops.push(rollUnique());
  // Potion drops
  const potRoll = Math.random();
  if (potRoll < (en.boss ? 0.40 : 0.07)) {
    drops.push({ ...ITEM_TEMPLATES.consumable[0], id: Math.random().toString(36).slice(2), rarity: 'normal' });
  } else if (potRoll < (en.boss ? 0.70 : 0.12)) {
    drops.push({ ...ITEM_TEMPLATES.consumable[1], id: Math.random().toString(36).slice(2), rarity: 'normal' });
  }
  drops.forEach(drop => {
    const ox = en.x+(Math.random()-0.5)*40, oy = en.y+(Math.random()-0.5)*40;
    const id = Math.random().toString(36).slice(2);
    G.lootDrops.push({x:ox,y:oy,item:drop,id});
    const el = document.createElement('div');
    el.id = 'loot-'+id;
    if (drop.type==='gold') { el.className='loot-label gold-loot'; el.textContent='⬡ '+drop.amount+' Gold'; }
    else { el.className='loot-label '+(drop.rarity!=='normal'?drop.rarity:''); el.textContent=drop.icon+' '+drop.name; }
    el.style.position='absolute';
    el.onclick = () => pickupLoot(id);
    document.getElementById('ui').appendChild(el);
  });
}

function pickupLoot(id) {
  const idx = G.lootDrops.findIndex(d=>d.id===id);
  if (idx===-1) return;
  const drop = G.lootDrops[idx];
  G.lootDrops.splice(idx,1);
  const el = document.getElementById('loot-'+id);
  if (el) el.remove();
  if (drop.item.type==='gold') { G.gold+=drop.item.amount; document.getElementById('gold-display').textContent='⬡ '+G.gold+' Gold'; addMsg(`Picked up ${drop.item.amount} gold`,'#ffd700'); }
  else if (G.bag.length < 20) { G.bag.push(drop.item); addMsg(`Picked up: ${drop.item.name}`, RARITY_COLORS[drop.item.rarity]); updatePotionBelt(); }
  else addMsg('Inventory full!','#ff4444');
}

function updateLootPositions() {
  G.lootDrops.forEach(drop => {
    const el = document.getElementById('loot-'+drop.id);
    if (!el) return;
    const [sx, sy] = w2s(drop.x, drop.y);
    if (sx<-60||sx>canvas.width+60||sy<-20||sy>canvas.height+20) { el.style.display='none'; return; }
    el.style.display=''; el.style.left=(sx-40)+'px'; el.style.top=(sy-8)+'px';
  });
}

function spawnParticles(x, y, color, count) {
  for (let i=0;i<count;i++) { const a=Math.random()*Math.PI*2, s=1+Math.random()*3; G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:20+Math.random()*20,color,size:2+Math.random()*3}); }
}

function spawnFloatingText(x, y, text, cls) {
  const el = document.createElement('div');
  el.className='dmg-float '+(cls||'');
  el.textContent=text;
  const [sx, sy] = w2s(x, y);
  el.style.left=(sx-20)+'px'; el.style.top=(sy-20)+'px';
  document.getElementById('ui').appendChild(el);
  setTimeout(()=>el.remove(),1000);
}

function addMsg(text, color) {
  const log=document.getElementById('msglog');
  const el=document.createElement('div');
  el.className='msg'; el.style.color=color||'#c8a96e'; el.textContent=text;
  log.appendChild(el);
  if (log.children.length>5) log.children[0].remove();
  setTimeout(()=>el.classList.add('fade'),3000);
  setTimeout(()=>el.remove(),5000);
}

let lastTime = 0;
function gameLoop(ts) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(ts-lastTime,50); lastTime=ts;
  G.tick++;
  if (!G.player) return;
  update(dt); render();
}

function update(dt) {
  const p = G.player;
  if (isMouseDown) handleLeftMouse(mouseWorld.x, mouseWorld.y);
  if (G.tick%60===0) { p.hp=Math.min(p.maxHp,p.hp+p.hpRegen); p.mp=Math.min(p.maxMp,p.mp+p.mpRegen); }
  if (p.buffTimer>0) { p.buffTimer--; if (p.buffTimer===0) p.buffDmg=0; }
  if (p.shieldTimer>0) { p.shieldTimer--; p.invincible=Math.max(p.invincible,1); }
  for (let i=0;i<4;i++) if (G.skillCooldowns[i]>0) G.skillCooldowns[i]--;

  const eq = G.equipped;
  const speedMult = 1+(eq.boots?(eq.boots.spd||0)/100:0);
  const spd = p.spd*speedMult;

  if (p.attackTarget) {
    const target = G.enemies.find(e => e.id === p.attackTarget && !e.dead);
    if (!target) { p.attackTarget = null; }
    else {
      p.targetX = target.x; p.targetY = target.y;
      if (dist2(p, target) <= p.range * p.range) { p.moving = false; }
      else { p.moving = true; }
    }
  }

  if (p.moving&&p.targetX!==null) {
    const dx=p.targetX-p.x, dy=p.targetY-p.y, d=Math.sqrt(dx*dx+dy*dy);
    if (d<spd+1) { p.moving=false; }
    else { const nx_=p.x+(dx/d)*spd, ny_=p.y+(dy/d)*spd; if (isWalkable(Math.floor(nx_/TILE),Math.floor(ny_/TILE))) { p.x=nx_; p.y=ny_; } else p.moving=false; }
  }

  if (p.moving && p.targetX !== null) {
    p.facingAngle = Math.atan2(p.targetY - p.y, p.targetX - p.x);
  }

  let kx=0, ky=0;
  const D = 0.7071 * spd;
  if (keys['w']||keys['arrowup'])    { kx -= D; ky -= D; }
  if (keys['s']||keys['arrowdown'])  { kx += D; ky += D; }
  if (keys['a']||keys['arrowleft'])  { kx -= D; ky += D; }
  if (keys['d']||keys['arrowright']) { kx += D; ky -= D; }
  if (kx !== 0 || ky !== 0) {
    p.attackTarget = null;
    p.targetX = null; p.targetY = null;
    const nx_ = p.x + kx, ny_ = p.y + ky;
    const tx_ = Math.floor(nx_/TILE), ty_ = Math.floor(ny_/TILE);
    const tx0 = Math.floor(p.x/TILE), ty0 = Math.floor(p.y/TILE);
    if (isWalkable(tx_, ty_)) {
      p.x = nx_; p.y = ny_;
    } else if (isWalkable(tx_, ty0)) {
      p.x = nx_;
    } else if (isWalkable(tx0, ty_)) {
      p.y = ny_;
    }
    p.facingAngle = Math.atan2(ky, kx);
    p.moving = true;
  } else if (p.targetX === null && !p.attackTarget) {
    p.moving = false;
  }

  cam.x+=(p.x-canvas.width/2-cam.x)*0.1;
  cam.y+=(p.y-canvas.height/2-cam.y)*0.1;
  cam.x=Math.max(0,Math.min(cam.x,COLS*TILE-canvas.width));
  cam.y=Math.max(0,Math.min(cam.y,ROWS*TILE-canvas.height));

  if (p.attackCd>0) p.attackCd--;
  if (p.attackCd<=0) {
    const targeted = p.attackTarget ? G.enemies.find(e => e.id === p.attackTarget && !e.dead) : null;
    const nearest = targeted;
    if (nearest && dist2(p,nearest) < p.range*p.range) {
      const baseDmg = p.dmg+(eq.weapon?eq.weapon.dmg||0:0)+(eq.gloves?eq.gloves.dmg||0:0)+(eq.ring1?eq.ring1.dmg||0:0)+(eq.ring2?eq.ring2.dmg||0:0)+p.buffDmg;
      const angle = Math.atan2(nearest.y-p.y, nearest.x-p.x);
      p.facingAngle = angle;
      G.slashEffects.push({ x: p.x+Math.cos(angle)*30, y: p.y+Math.sin(angle)*30, life: 10, maxLife: 10, color: p.color, angle });
      dealDamage(nearest, baseDmg*0.8, p.color, p.x, p.y);
      p.attackCd = getEffectiveAttackRate();
      p.attackTarget = null;
    }
  }

  for (let i = G.lootDrops.length-1; i >= 0; i--) {
    const drop = G.lootDrops[i];
    if (drop.item.type === 'gold' && dist2(p, drop) < 35*35) pickupLoot(drop.id);
  }

  if (G.inHub) {
    checkHubInteractions();
  } else {
    const nearPortal = G.portalOpen && dist2(p, {x:G.portalX, y:G.portalY}) < 40*40;
    const nearLootDrop = G.lootDrops.filter(d => d.item.type !== 'gold' && dist2(p, d) < 55*55)
      .sort((a, b) => dist2(p, a) - dist2(p, b))[0] || null;
    G.nearPortal = nearPortal;
    G.nearLoot = nearLootDrop;
    const prompt = document.getElementById('hub-prompt');
    if (nearPortal) { prompt.textContent = '[F] Next Level'; prompt.style.display = 'block'; }
    else if (nearLootDrop) { prompt.textContent = '[F] Pick up: ' + nearLootDrop.item.name; prompt.style.display = 'block'; }
    else prompt.style.display = 'none';
  }

  G.enemies.forEach(en => {
    if (en.dying) {
      en.deathTick++;
      en.deathFrame = Math.min(7, Math.floor(en.deathTick / 6));
      if (en.deathTick >= 50) { en.dead = true; en.dying = false; }
      return;
    }
    if (en.dead) return;
    if (en.frozen>0) { en.frozen--; return; }
    if (en.poisoned&&en.poisonTimer>0) { en.poisonTimer--; if (G.tick%30===0) { en.hp-=en.poisoned; spawnParticles(en.x,en.y,'#40c040',2); if (en.hp<=0) killEnemy(en); } }
    if (en.bleedTimer>0) { en.bleedTimer--; if (G.tick%20===0) { en.hp-=en.bleedDmg; spawnFloatingText(en.x,en.y,'-'+en.bleedDmg,''); spawnParticles(en.x,en.y,'#cc1010',2); if (en.hp<=0&&!en.dying&&!en.dead) killEnemy(en); } }
    const d2p=dist2(en,p), aggroRange=(en.aggressive?160:90)*TILE/40;
    G.enemies.forEach(other => {
      if (other === en || other.dead) return;
      const sep2 = dist2(en, other);
      const minSep = (en.size + other.size) * 0.9;
      if (sep2 < minSep * minSep && sep2 > 0) {
        const sep = Math.sqrt(sep2);
        const push = (minSep - sep) / sep * 0.4;
        en.x += (en.x - other.x) * push;
        en.y += (en.y - other.y) * push;
      }
    });
    if (d2p<aggroRange*aggroRange||en.state==='chase') {
      en.state='chase';
      const dx=p.x-en.x, dy=p.y-en.y, d=Math.sqrt(dx*dx+dy*dy);
      if (d>en.size+12) { en.x+=(dx/d)*en.spd; en.y+=(dy/d)*en.spd; }
      if (en.attackCd>0) en.attackCd--;
      if (en.attackCd<=0&&d<en.size+20) {
        const def=Object.values(eq).filter(Boolean).reduce((s,i)=>s+(i.def||0),0);
        let inDmg=Math.max(1,en.dmg-def*0.4);
        const allEq=Object.values(eq).filter(Boolean);
        if (allEq.some(i=>i.uniqueId==='pact')) inDmg=Math.round(inDmg*1.2);
        if (allEq.some(i=>i.uniqueId==='thornmail')) { en.hp-=Math.round(inDmg*0.25); if(en.hp<=0&&!en.dying&&!en.dead) killEnemy(en); }
        if (p.invincible<=0) { p.hp-=inDmg; p.invincible=15; spawnFloatingText(p.x,p.y,'-'+Math.round(inDmg),''); if (p.hp<=0) playerDeath(); }
        en.attackCd=60;
      }
      if (en.ranged&&d>80&&en.attackCd<=0) {
        const d_=Math.sqrt(dx*dx+dy*dy);
        G.projectiles.push({x:en.x,y:en.y,vx:(dx/d_)*4,vy:(dy/d_)*4,dmg:en.dmg*0.7,color:'#c02020',size:5,life:100,owner:'enemy'});
        en.attackCd=80;
      }
    } else en.state='idle';
  });

  if (p.invincible>0) p.invincible--;

  G.minions.forEach(mn => {
    const target=G.enemies.filter(e=>!e.dead).sort((a,b)=>dist2(mn,a)-dist2(mn,b))[0];
    if (!target) return;
    const dx=target.x-mn.x, dy=target.y-mn.y, d=Math.sqrt(dx*dx+dy*dy);
    if (d>30) { mn.x+=(dx/d)*mn.spd; mn.y+=(dy/d)*mn.spd; }
    if (mn.attackCd>0) mn.attackCd--;
    if (mn.attackCd<=0&&d<40) { dealDamage(target,mn.dmg,mn.color); mn.attackCd=40; }
  });

  G.projectiles=G.projectiles.filter(proj => {
    proj.x+=proj.vx; proj.y+=proj.vy; proj.life--;
    if (proj.life<=0) { if(proj.explode) spawnParticles(proj.x,proj.y,proj.color,15); return false; }
    if (!isWalkable(Math.floor(proj.x/TILE),Math.floor(proj.y/TILE))) { if(proj.explode) spawnParticles(proj.x,proj.y,proj.color,12); return false; }
    if (proj.owner==='player') {
      let hit=false;
      G.enemies.forEach(en => {
        if (en.dead || en.dying) return;
        if (proj.type==='pierce'&&proj.pierced.has(en.id)) return;
        if (dist2(proj,en)<(en.size+proj.size)**2) {
          dealDamage(en,proj.dmg,proj.color);
          if (proj.type==='pierce') proj.pierced.add(en.id);
          else if (proj.explode) { G.enemies.forEach(e2=>{if(!e2.dead&&dist2(proj,e2)<50*50)dealDamage(e2,proj.dmg*0.5,proj.color);}); spawnParticles(proj.x,proj.y,proj.color,15); hit=true; }
          else hit=true;
        }
      });
      if (hit&&proj.type!=='pierce') return false;
    } else {
      if (dist2(proj,p)<(12+proj.size)**2&&p.invincible<=0) {
        const def=(eq.armor?(eq.armor.def||0):0);
        p.hp-=Math.max(1,proj.dmg-def*0.3); p.invincible=20;
        spawnFloatingText(p.x,p.y,'-'+Math.round(proj.dmg),'');
        if (p.hp<=0) playerDeath();
        return false;
      }
    }
    return true;
  });

  G.particles=G.particles.filter(pt=>{pt.x+=pt.vx;pt.y+=pt.vy;pt.vx*=0.9;pt.vy*=0.9;pt.life--;return pt.life>0;});

  if (G.tick%6===0) {
    const hpPct = Math.max(0, p.hp/p.maxHp);
    const mpPct = Math.max(0, p.mp/p.maxMp);
    document.getElementById('hp-text').textContent=Math.max(0,Math.round(p.hp))+'/'+p.maxHp;
    document.getElementById('mp-text').textContent=Math.max(0,Math.round(p.mp))+'/'+p.maxMp;
    document.getElementById('orb-hp-fill').style.height=(hpPct*100).toFixed(1)+'%';
    document.getElementById('orb-mp-fill').style.height=(mpPct*100).toFixed(1)+'%';
    document.getElementById('xp-bar').style.width=(p.xp/p.xpNext*100).toFixed(1)+'%';
    updateSkillBar(); updateLootPositions(); updatePotionBelt();
  }
}

function playerDeath() {
  if (!G.player) return;
  const p = G.player;
  const savedLevel = p.level, savedXP = p.xp, savedXPNext = p.xpNext;
  const newP = createPlayer(p.cls);
  newP.level = savedLevel; newP.xp = savedXP; newP.xpNext = savedXPNext;
  for (let i = 1; i < savedLevel; i++) {
    newP.maxHp = Math.round(newP.maxHp * 1.1 + 10);
    newP.maxMp = Math.round(newP.maxMp * 1.1 + 5);
    newP.dmg += 2;
  }
  const cp = getCharPersist();
  SHRINE_UPGRADES.forEach(upg => {
    const rank = cp.upgrades[upg.id] || 0;
    for (let i = 0; i < rank; i++) upg.apply(newP);
  });
  newP.hp = newP.maxHp; newP.mp = newP.maxMp;
  G.player = newP;
  G.bag = [];
  G.equipped = { weapon: null, armor: null, helm: null, boots: null };
  G.gold = 0;
  G.runBlessing = null;
  clearLootLabels();
  document.getElementById('gold-display').textContent = '⬡ 0 Gold';
  document.getElementById('char-level').textContent = 'Level ' + savedLevel;
  updatePotionBelt();
  const ov = document.getElementById('overlay');
  ov.style.display = 'flex';
  ov.innerHTML = `<h1 style="color:#ff2020;">YOU DIED</h1><p style="color:#c8a96e;">All gold and equipment is lost.<br>You wake at the Hearth, empty-handed.</p><button class="big-btn" onclick="document.getElementById('overlay').style.display='none';loadHub();">Return to the Hearth</button>`;
}

function loadPersistent() {
  try {
    const saved = localStorage.getItem('darklands_persistent');
    if (saved) G.persistent = { ...G.persistent, ...JSON.parse(saved) };
  } catch(e) {}
  if (!G.persistent.sharedStash) G.persistent.sharedStash = [];
  if (!G.persistent.characters) G.persistent.characters = {};
  if (!G.persistent.lastDepth) G.persistent.lastDepth = 0;
  if (!G.persistent.stashGold) G.persistent.stashGold = 0;
}
function savePersistent() {
  try { localStorage.setItem('darklands_persistent', JSON.stringify(G.persistent)); } catch(e) {}
}
function getCharPersist() {
  if (!G.player) return { upgrades: {} };
  const cls = G.player.cls;
  if (!G.persistent.characters[cls]) G.persistent.characters[cls] = { upgrades: {} };
  return G.persistent.characters[cls];
}

function generateHubMap() {
  const tiles = [];
  for (let y = 0; y < ROWS; y++) { tiles[y] = []; for (let x = 0; x < COLS; x++) tiles[y][x] = 1; }
  for (let y = 4; y < ROWS-4; y++) for (let x = 6; x < COLS-6; x++) tiles[y][x] = 0;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6-i; j++) {
    tiles[4+i][6+j] = 1; tiles[4+i][COLS-7-j] = 1;
    tiles[ROWS-5-i][6+j] = 1; tiles[ROWS-5-i][COLS-7-j] = 1;
  }
  return { tiles, rooms: [{ cx: Math.floor(COLS/2), cy: Math.floor(ROWS/2) }] };
}
function clearLootLabels() { document.querySelectorAll('.loot-label').forEach(e => e.remove()); }

function spawnHubProps(cx, cy) {
  const p = (key, ax, ay, opts={}) => ({ key, x: ax*TILE, y: ay*TILE, ...opts });
  const lit = { anim:'brazier_lit_SE', frames:8, fps:5 };
  return [
    p('brazier_lit_SE_0', cx-3, cy, lit), p('brazier_lit_SE_0', cx+3, cy, lit),
    p('brazier_lit_SE_0', cx, cy-3, lit), p('brazier_lit_SE_0', cx, cy+3, lit),
    p('brazier_lit_SE_0', cx-2, cy-2, lit), p('brazier_lit_SE_0', cx+2, cy-2, lit),
    p('column1_SE', cx-11, cy-5), p('column2_SE', cx-11, cy-1),
    p('crate_SE', cx-12, cy-4), p('crate_SE', cx-12, cy-3), p('crate_SE', cx-12, cy-2),
    p('barrel_SE', cx-10, cy-4), p('barrel_SE', cx-10, cy-3),
    p('barrel_SE', cx-13, cy-4), p('barrel_SE', cx-13, cy-3),
    p('torch_SE', cx-11, cy-6), p('torch_SE', cx-7, cy-2),
    p('barrel_SE', cx-10, cy+4), p('barrel_SE', cx-11, cy+5),
    p('crate_SE', cx-10, cy+6), p('crate_SE', cx-12, cy+5), p('barrel_SE', cx-8, cy+5),
    p('column1_SE', cx+6, cy-5), p('column2_SE', cx+10, cy-5),
    p('column1_SE', cx+6, cy-1), p('column2_SE', cx+10, cy-1),
    p('column1_SE', cx+7, cy-5), p('column1_SE', cx+9, cy-5),
    p('brazier_lit_SE_0', cx+5, cy-3, lit), p('brazier_lit_SE_0', cx+11, cy-3, lit),
    p('torch_SE', cx+7, cy-6), p('torch_SE', cx+9, cy-6),
    p('column1_SE', cx-3, cy+5), p('column2_SE', cx+3, cy+5),
    p('column1_SE', cx-3, cy+9), p('column2_SE', cx+3, cy+9),
    p('brazier_lit_SE_0', cx-2, cy+6, lit), p('brazier_lit_SE_0', cx+2, cy+6, lit),
    p('brazier_lit_SE_0', cx-2, cy+8, lit), p('brazier_lit_SE_0', cx+2, cy+8, lit),
    p('rocks_SE', cx-14, cy-4), p('rocks_SE', cx+12, cy-4),
    p('rocks_SE', cx-14, cy+3), p('rocks_SE', cx+12, cy+3),
    p('bones1_SE', cx-12, cy-5), p('bones2_SE', cx+11, cy-5),
    p('bones3_SE', cx-12, cy+6), p('bones1_SE', cx+11, cy+6),
    p('bones2_SE', cx, cy-8), p('bones3_SE', cx-5, cy+9), p('bones1_SE', cx+5, cy+9),
    p('mushrooms_SE', cx-13, cy+1), p('mushrooms_SE', cx+12, cy+2),
    p('mushrooms_SE', cx-4, cy-8), p('mushrooms_SE', cx+4, cy-8),
    p('brazier_SE', cx-6, cy+9), p('brazier_SE', cx+5, cy-7),
    p('torch_SE', cx-14, cy-2), p('torch_SE', cx-14, cy+2),
    p('torch_SE', cx+12, cy-2), p('torch_SE', cx+12, cy+2),
    p('torch_SE', cx-5, cy-9), p('torch_SE', cx+5, cy-9),
  ];
}

function spawnDungeonProps(map) {
  const props = [];
  const propPools = [
    ['barrel_SE'], ['crate_SE'], ['bones1_SE','bones2_SE','bones3_SE'],
    ['rocks_SE','bricks_SE'], ['mushrooms_SE'], ['torch_SE'], ['brazier_SE'],
  ];
  map.rooms.forEach(room => {
    const count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const tx = room.cx + Math.floor((Math.random()-0.5)*6);
        const ty = room.cy + Math.floor((Math.random()-0.5)*6);
        if (!isWalkable(tx, ty)) continue;
        const pool = propPools[Math.floor(Math.random() * propPools.length)];
        const key = pool[Math.floor(Math.random() * pool.length)];
        props.push({ key, x: tx*TILE + TILE/2, y: ty*TILE + TILE/2 });
        break;
      }
    }
  });
  return props;
}

function loadHub() {
  G.inHub = true; G.depth = 0; G.area = 0;
  G.map = generateHubMap();
  G.enemies = []; G.projectiles = []; G.particles = []; G.slashEffects = [];
  G.lootDrops = []; G.minions = []; G.portalOpen = false; G.nearPortal = false; G.props = [];
  clearLootLabels();
  const cx = Math.floor(COLS/2), cy = Math.floor(ROWS/2);
  G.props = spawnHubProps(cx, cy);
  G.hubObjects = [
    { type:'campfire', x:(cx)*TILE,   y:(cy)*TILE,   label:'Campfire',        hint:'[F] Rest & Heal' },
    { type:'merchant', x:(cx-9)*TILE, y:(cy-2)*TILE, label:'Merchant',        hint:'[F] Shop' },
    { type:'stash',    x:(cx-8)*TILE, y:(cy+4)*TILE, label:'Shared Stash',    hint:'[F] Open Stash' },
    { type:'shrine',   x:(cx+8)*TILE, y:(cy-2)*TILE, label:'Shrine of Power', hint:'[F] Upgrade' },
    { type:'portal',   x:(cx)*TILE,   y:(cy+7)*TILE, label:'Dark Portal',     hint:'[F] Enter Dungeon' },
  ];
  const p = G.player;
  p.x = (cx + 1) * TILE; p.y = (cy + 1) * TILE;
  p.hp = p.maxHp; p.mp = p.maxMp; p.invincible = 0; p.shieldTimer = 0;
  generateShop();
  document.getElementById('area-name').textContent = 'The Last Hearth';
  document.getElementById('depth-indicator').style.display = 'none';
  document.getElementById('kill-count').textContent = 'Kills: ' + G.kills;
  showAreaMsg('The Last Hearth');
  closeAllPanels();
}

let shopInventory = [];
function generateShop() {
  const depth = Math.max(1, G.persistent.lastDepth || 1);
  shopInventory = Array.from({length:6}, () => {
    const item = rollItem(depth * 2);
    item.price = Math.round((25 + depth * 18) * (1 + ({normal:0, magic:0.8, rare:2.2, unique:6}[item.rarity] || 0)));
    return item;
  });
}
function showShop() { closeAllPanels(); document.getElementById('shop-panel').classList.add('open'); renderShop(); }
function renderShop() {
  document.getElementById('shop-gold').textContent = 'Your gold: ⬡ ' + G.gold;
  const container = document.getElementById('shop-items');
  container.innerHTML = '';
  // Always-available potions
  const depth = Math.max(1, G.persistent?.lastDepth || 1);
  const potions = [
    { type: 'hp', icon: '🧪', name: 'Healing Potion', price: Math.round(18 + depth * 4) },
    { type: 'mp', icon: '💧', name: 'Mana Potion',    price: Math.round(14 + depth * 3) },
  ];
  const potTitle = document.createElement('div');
  potTitle.className = 'panel-title';
  potTitle.style.cssText = 'font-size:11px;margin-bottom:4px;';
  potTitle.textContent = '⚗ Potions — always in stock';
  container.appendChild(potTitle);
  potions.forEach(p => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `<span><span style="font-size:15px;">${p.icon}</span> ${p.name}</span>` +
      `<button class="upg-btn" ${G.gold < p.price ? 'disabled' : ''} onclick="buyPotion('${p.type}')">⬡${p.price}</button>`;
    container.appendChild(div);
  });
  // Random gear
  const gearTitle = document.createElement('div');
  gearTitle.className = 'panel-title';
  gearTitle.style.cssText = 'font-size:11px;margin-top:10px;margin-bottom:4px;';
  gearTitle.textContent = '⚒ Gear';
  container.appendChild(gearTitle);
  shopInventory.forEach((item, i) => {
    if (!item) return;
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `<span><span style="font-size:15px;">${item.icon}</span> <span class="rarity-${item.rarity}">${item.name}</span></span>` +
      `<button class="upg-btn" ${G.gold < item.price ? 'disabled' : ''} onclick="buyShopItem(${i})">⬡${item.price}</button>`;
    div.onmouseenter = e => showTooltip(e, item); div.onmouseleave = hideTooltip;
    container.appendChild(div);
  });
  // Sell section
  const sellEl = document.getElementById('shop-sell');
  sellEl.innerHTML = '<div class="panel-title" style="font-size:11px;margin-top:10px;border-top:1px solid #3a2a0e;padding-top:8px;">↑ Sell to Merchant</div>';
  const sellable = G.bag.filter(i => i.base !== 'consumable');
  if (sellable.length === 0) {
    sellEl.innerHTML += '<div style="font-size:11px;color:#555;text-align:center;padding:4px 0;">— No gear to sell —</div>';
  } else {
    sellable.forEach(item => {
      const price = getSellPrice(item);
      const div = document.createElement('div');
      div.className = 'shop-item';
      div.innerHTML = `<span><span style="font-size:15px;">${item.icon}</span> <span class="rarity-${item.rarity}">${item.name}</span></span>` +
        `<button class="upg-btn" onclick="sellBagItem('${item.id}')">⬡${price}</button>`;
      div.onmouseenter = e => showTooltip(e, item); div.onmouseleave = hideTooltip;
      sellEl.appendChild(div);
    });
  }
}
function buyShopItem(i) {
  const item = shopInventory[i];
  if (!item || G.gold < item.price) { addMsg('Not enough gold!', '#ff4444'); return; }
  if (G.bag.length >= 20) { addMsg('Inventory full!', '#ff4444'); return; }
  G.gold -= item.price; G.bag.push(item); shopInventory[i] = null;
  document.getElementById('gold-display').textContent = '⬡ ' + G.gold + ' Gold';
  addMsg('Bought: ' + item.name, RARITY_COLORS[item.rarity]);
  updatePotionBelt(); renderShop();
}
function buyPotion(type) {
  if (!G.player) return;
  if (G.bag.length >= 20) { addMsg('Inventory full!', '#ff4444'); return; }
  const depth = Math.max(1, G.persistent?.lastDepth || 1);
  const price = type === 'hp' ? Math.round(18 + depth * 4) : Math.round(14 + depth * 3);
  if (G.gold < price) { addMsg('Not enough gold!', '#ff4444'); return; }
  G.gold -= price;
  const template = type === 'hp' ? ITEM_TEMPLATES.consumable[0] : ITEM_TEMPLATES.consumable[1];
  G.bag.push({ ...template, id: Math.random().toString(36).slice(2), rarity: 'normal' });
  document.getElementById('gold-display').textContent = '⬡ ' + G.gold + ' Gold';
  addMsg(`Bought ${template.name}`, '#44ff44');
  updatePotionBelt(); renderShop();
}

function showStash() { closeAllPanels(); document.getElementById('stash-panel').classList.add('open'); renderStash(); }
function depositGold() {
  const input = document.getElementById('stash-gold-input');
  const amt = Math.min(parseInt(input.value) || G.gold, G.gold);
  if (amt <= 0) return;
  G.gold -= amt; G.persistent.stashGold += amt;
  document.getElementById('gold-display').textContent = '⬡ ' + G.gold + ' Gold';
  savePersistent(); input.value = ''; renderStash();
}
function withdrawGold() {
  const input = document.getElementById('stash-gold-input');
  const amt = Math.min(parseInt(input.value) || G.persistent.stashGold, G.persistent.stashGold);
  if (amt <= 0) return;
  G.persistent.stashGold -= amt; G.gold += amt;
  document.getElementById('gold-display').textContent = '⬡ ' + G.gold + ' Gold';
  savePersistent(); input.value = ''; renderStash();
}
function renderStash() {
  document.getElementById('stash-gold-amount').textContent = G.persistent.stashGold.toLocaleString();
  document.getElementById('stash-carried-amount').textContent = G.gold.toLocaleString();
  const stash = G.persistent.sharedStash;
  const stashEl = document.getElementById('stash-grid');
  stashEl.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const item = stash[i];
    const slot = document.createElement('div');
    slot.className = 'stash-slot' + (item ? '' : ' empty');
    if (item) {
      slot.innerHTML = `<span style="font-size:15px;">${item.icon}</span><span style="font-size:8px;color:${RARITY_COLORS[item.rarity]};overflow:hidden;width:100%;text-align:center;padding:0 2px;">${item.name.split(' ')[0]}</span>`;
      slot.onclick = () => stashToBag(i);
      slot.onmouseenter = e => showTooltip(e, item); slot.onmouseleave = hideTooltip;
    }
    stashEl.appendChild(slot);
  }
  const bagEl = document.getElementById('stash-bag');
  bagEl.innerHTML = '';
  G.bag.forEach((item, i) => {
    const slot = document.createElement('div');
    slot.className = 'stash-slot';
    slot.innerHTML = `<span style="font-size:15px;">${item.icon}</span><span style="font-size:8px;color:${RARITY_COLORS[item.rarity]};overflow:hidden;width:100%;text-align:center;padding:0 2px;">${item.name.split(' ')[0]}</span>`;
    slot.onclick = () => bagToStash(i);
    slot.onmouseenter = e => showTooltip(e, item); slot.onmouseleave = hideTooltip;
    bagEl.appendChild(slot);
  });
}
function stashToBag(i) {
  if (!G.persistent.sharedStash[i]) return;
  if (G.bag.length >= 20) { addMsg('Bag full!', '#ff4444'); return; }
  G.bag.push(G.persistent.sharedStash[i]); G.persistent.sharedStash.splice(i, 1);
  savePersistent(); updatePotionBelt(); renderStash();
}
function bagToStash(i) {
  if (G.persistent.sharedStash.length >= 40) { addMsg('Stash full!', '#ff4444'); return; }
  G.persistent.sharedStash.push(G.bag[i]); G.bag.splice(i, 1);
  savePersistent(); updatePotionBelt(); renderStash();
}

function showShrine() { closeAllPanels(); document.getElementById('shrine-panel').classList.add('open'); renderShrine(); }
function renderShrine() {
  document.getElementById('shrine-gold').textContent = 'Your gold: ⬡ ' + G.gold;
  const cp = getCharPersist();
  const container = document.getElementById('shrine-upgrades');
  container.innerHTML = '';
  SHRINE_UPGRADES.forEach(upg => {
    const rank = cp.upgrades[upg.id] || 0;
    const cost = rank < upg.maxRank ? upg.baseCost + rank * upg.costPerRank : null;
    const div = document.createElement('div'); div.className = 'shrine-upgrade';
    div.innerHTML = `<div class="upg-info"><div style="color:#ffd700;">${upg.icon} ${upg.name} <span style="color:#555;">(${rank}/${upg.maxRank})</span></div><div style="color:#777;font-size:10px;">${upg.desc}</div></div>`;
    if (cost !== null) {
      const btn = document.createElement('button'); btn.className = 'upg-btn'; btn.textContent = '⬡' + cost;
      btn.disabled = G.gold < cost; btn.onclick = () => buyUpgrade(upg.id); div.appendChild(btn);
    } else { const mx = document.createElement('span'); mx.style.cssText='color:#ffd700;font-size:10px;margin-left:8px;'; mx.textContent='MAXED'; div.appendChild(mx); }
    container.appendChild(div);
  });
}
function buyUpgrade(id) {
  const cp = getCharPersist();
  const upg = SHRINE_UPGRADES.find(u => u.id === id);
  const rank = cp.upgrades[id] || 0;
  if (rank >= upg.maxRank) return;
  const cost = upg.baseCost + rank * upg.costPerRank;
  if (G.gold < cost) { addMsg('Not enough gold!', '#ff4444'); return; }
  G.gold -= cost; cp.upgrades[id] = rank + 1; upg.apply(G.player);
  savePersistent();
  document.getElementById('gold-display').textContent = '⬡ ' + G.gold + ' Gold';
  addMsg(upg.name + ' upgraded to rank ' + (rank+1) + '!', '#ffd700');
  renderShrine();
}

function showBlessingScreen() {
  const picks = [...BLESSINGS].sort(() => Math.random()-0.5).slice(0,3);
  const cards = document.getElementById('blessing-cards');
  cards.innerHTML = '';
  picks.forEach(b => {
    const card = document.createElement('div'); card.className = 'blessing-card';
    card.innerHTML = `<div style="font-size:34px;">${b.icon}</div><div style="color:#ffd700;font-size:13px;font-weight:bold;margin:6px 0;">${b.name}</div><div style="color:#888;font-size:11px;line-height:1.5;">${b.desc}</div>`;
    card.onclick = () => { G.runBlessing = b; applyBlessing(b); document.getElementById('blessing-screen').classList.remove('open'); startRun(); };
    cards.appendChild(card);
  });
  document.getElementById('blessing-screen').classList.add('open');
}
function applyBlessing(b) {
  const p = G.player;
  if (b.dmgMult)        p.dmg         = Math.round(p.dmg * b.dmgMult);
  if (b.hpMult)         { p.maxHp = Math.round(p.maxHp * b.hpMult); p.hp = p.maxHp; }
  if (b.spdMult)        p.spd         = p.spd * b.spdMult;
  if (b.defMult)        p.def         = Math.round(p.def * b.defMult);
  if (b.flatHp)         { p.maxHp += b.flatHp; p.hp = Math.min(p.hp + b.flatHp, p.maxHp); }
  if (b.flatDef)        p.def        += b.flatDef;
  if (b.regenMult)      { p.hpRegen *= b.regenMult; p.mpRegen *= b.regenMult; }
  if (b.attackRateMult) p.attackRate  = Math.round(p.attackRate * b.attackRateMult);
  addMsg('Blessed: ' + b.name + '!', '#ffd700');
}

function startRun() {
  G.inHub = false; G.depth = 1; G.area = 0; G.hubObjects = [];
  clearLootLabels();
  loadArea(0, true);
  document.getElementById('depth-indicator').style.display = 'block';
  document.getElementById('depth-indicator').textContent = 'Depth ' + G.depth;
}
function showDepthChoice() {
  G.portalOpen = false; G.nearPortal = false;
  const el = document.getElementById('depth-choice');
  document.getElementById('depth-choice-info').textContent =
    'Depth ' + G.depth + ' cleared. Next depth: enemies +' + Math.round(G.depth * 30) + '% stronger. Loot scales up.';
  el.classList.add('open');
}
function pushDeeper() {
  document.getElementById('depth-choice').classList.remove('open');
  G.depth++; G.area = Math.min(G.area + 1, G.areaNames.length - 1);
  clearLootLabels(); loadArea(G.area, false);
  document.getElementById('depth-indicator').textContent = 'Depth ' + G.depth;
  addMsg('Descending to depth ' + G.depth + '...', '#c060ff');
}
function returnToHub() {
  document.getElementById('depth-choice').classList.remove('open');
  G.persistent.lastDepth = Math.max(G.persistent.lastDepth || 0, G.depth);
  savePersistent(); loadHub();
}

function checkHubInteractions() {
  if (!G.inHub || !G.player) return;
  const p = G.player;
  let nearest = null, nearestDist = 85 * 85;
  G.hubObjects.forEach(obj => {
    const d = dist2(p, { x: obj.x, y: obj.y });
    if (d < nearestDist) { nearestDist = d; nearest = obj; }
  });
  G.nearHubObject = nearest;
  const prompt = document.getElementById('hub-prompt');
  if (nearest) { prompt.textContent = nearest.hint; prompt.style.display = 'block'; }
  else prompt.style.display = 'none';
}
function interactHub() {
  if (!G.inHub || !G.nearHubObject) return;
  switch(G.nearHubObject.type) {
    case 'campfire': G.player.hp = G.player.maxHp; G.player.mp = G.player.maxMp; addMsg('You rest by the campfire. Fully restored.', '#ffaa40'); break;
    case 'merchant': showShop(); break;
    case 'stash':    showStash(); break;
    case 'shrine':   showShrine(); break;
    case 'portal':   showBlessingScreen(); break;
  }
}
function closeAllPanels() {
  ['shop-panel','stash-panel','shrine-panel','skill-tree-panel'].forEach(id => document.getElementById(id).classList.remove('open'));
  const hp = document.getElementById('hub-prompt'); if (hp) hp.style.display = 'none';
}

function _lc(c,t){const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);return'#'+[r+(255-r)*t,g+(255-g)*t,b+(255-b)*t].map(v=>Math.max(0,Math.min(255,~~v)).toString(16).padStart(2,'0')).join('');}
function _dc(c,t){const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);return'#'+[r*(1-t),g*(1-t),b*(1-t)].map(v=>Math.max(0,Math.min(255,~~v)).toString(16).padStart(2,'0')).join('');}
function _ge(x,y,rx,ry,rot,c){const r=Math.max(rx,ry),g=ctx.createRadialGradient(x-rx*.25,y-ry*.32,r*.03,x+rx*.12,y+ry*.22,r*1.38);g.addColorStop(0,_lc(c,.48));g.addColorStop(.32,c);g.addColorStop(1,_dc(c,.62));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,rx,ry,rot||0,0,Math.PI*2);ctx.fill();}
function _gf(cx,cy,rad,c){const g=ctx.createRadialGradient(cx-rad*.22,cy-rad*.28,rad*.03,cx+rad*.1,cy+rad*.18,rad*1.3);g.addColorStop(0,_lc(c,.42));g.addColorStop(.3,c);g.addColorStop(1,_dc(c,.60));ctx.fillStyle=g;}

function drawFallen(x,y,s){const lw=Math.sin(G.tick*0.1)*s*2;ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(x,y+s*8,s*6,s*2.5,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#3a0a02';ctx.lineWidth=s*2.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-s*2,y+s*3);ctx.lineTo(x-s*4,y+s*8);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*2,y+s*3);ctx.lineTo(x+s*4,y+s*8);ctx.stroke();_gf(x,y+s*4.5,s*5,'#2e1204');ctx.beginPath();ctx.moveTo(x-s*4,y+s*3);ctx.lineTo(x+s*4,y+s*3);ctx.lineTo(x+s*3,y+s*6);ctx.lineTo(x-s*3,y+s*6);ctx.fill();ctx.fillStyle='#180a02';ctx.beginPath();ctx.moveTo(x-s*1,y+s*3);ctx.lineTo(x+s*1,y+s*3);ctx.lineTo(x,y+s*6);ctx.fill();_ge(x,y-s*1,s*4,s*5,0,'#5e1206');ctx.strokeStyle='#3a0a02';ctx.lineWidth=s*2.5;ctx.beginPath();ctx.moveTo(x-s*3,y-s*2);ctx.lineTo(x-s*8+lw,y+s*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*3,y-s*2);ctx.lineTo(x+s*8-lw,y-s*1);ctx.stroke();ctx.strokeStyle='#201006';ctx.lineWidth=s*2;ctx.beginPath();ctx.moveTo(x+s*8-lw,y-s*1);ctx.lineTo(x+s*11-lw,y-s*7);ctx.stroke();_ge(x+s*11-lw,y-s*8,s*2.5,s*2,0,'#321608');_ge(x,y-s*9,s*6.5,s*7,0,'#6a1608');_gf(x-s*5,y-s*15,s*4,'#240602');ctx.beginPath();ctx.moveTo(x-s*5,y-s*13);ctx.quadraticCurveTo(x-s*8,y-s*18,x-s*4,y-s*17);ctx.lineTo(x-s*3,y-s*14);ctx.fill();_gf(x+s*5,y-s*15,s*4,'#240602');ctx.beginPath();ctx.moveTo(x+s*5,y-s*13);ctx.quadraticCurveTo(x+s*8,y-s*18,x+s*4,y-s*17);ctx.lineTo(x+s*3,y-s*14);ctx.fill();_ge(x-s*2.2,y-s*10,s*1.8,s*1.8,0,'#d4b800');_ge(x+s*2.2,y-s*10,s*1.8,s*1.8,0,'#d4b800');ctx.fillStyle='#000';ctx.beginPath();ctx.arc(x-s*2.2,y-s*10,s*0.8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*2.2,y-s*10,s*0.8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b09870';ctx.strokeStyle='#706040';ctx.lineWidth=s*0.5;ctx.beginPath();ctx.moveTo(x-s*2,y-s*5);ctx.lineTo(x-s*1,y-s*3.5);ctx.lineTo(x,y-s*5);ctx.lineTo(x+s*1,y-s*3.5);ctx.lineTo(x+s*2,y-s*5);ctx.stroke();}

function drawZombie(x,y,s){const lurch=Math.sin(G.tick*0.06)*s*2;ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(x,y+s*8,s*7,s*3,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#1a2810';ctx.lineWidth=s*3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-s*2,y+s*2);ctx.lineTo(x-s*4+lurch,y+s*8);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*2,y+s*2);ctx.lineTo(x+s*4-lurch,y+s*8);ctx.stroke();_gf(x,y-s*2.5,s*6,'#1e2e10');ctx.beginPath();ctx.roundRect(x-s*4,y-s*8,s*8,s*11,s*2);ctx.fill();ctx.fillStyle='#101e08';ctx.beginPath();ctx.moveTo(x-s*4,y-s*1);ctx.lineTo(x+s*4,y-s*1);ctx.lineTo(x+s*4,y+s*2);ctx.lineTo(x-s*4,y+s*2);ctx.fill();ctx.strokeStyle='#1e2e10';ctx.lineWidth=s*3;ctx.beginPath();ctx.moveTo(x-s*4,y-s*6);ctx.lineTo(x-s*10+lurch*0.5,y-s*5);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*4,y-s*6);ctx.lineTo(x+s*10-lurch*0.5,y-s*5);ctx.stroke();ctx.save();ctx.translate(x+s*2,y-s*13);ctx.rotate(0.25);_ge(0,0,s*5,s*6,0,'#2e3e1a');ctx.fillStyle='#701008';ctx.beginPath();ctx.ellipse(-s*2,-s*1,s*1.5,s*1,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#aa1400';ctx.beginPath();ctx.ellipse(-s*1.5,-s*2,s*1.2,s*1.2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(s*1.5,-s*2,s*1.2,s*1.2,0,0,Math.PI*2);ctx.fill();ctx.restore();}

function drawSkeleton(x,y,s){const walk=Math.sin(G.tick*0.12)*s*3;const bone='#8a8262',dark='#5a5240';ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(x,y+s*8,s*6,s*2.5,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=bone;ctx.lineWidth=s*2.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-s*2,y+s*2);ctx.lineTo(x-s*3,y+s*8+walk);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*2,y+s*2);ctx.lineTo(x+s*3,y+s*8-walk);ctx.stroke();_ge(x-s*2.5,y+s*5+walk*0.5,s*1.5,s*1.5,0,bone);_ge(x+s*2.5,y+s*5-walk*0.5,s*1.5,s*1.5,0,bone);_ge(x,y+s*1,s*4,s*2,0,bone);ctx.strokeStyle=bone;ctx.lineWidth=s*2;ctx.beginPath();ctx.moveTo(x,y+s*1);ctx.lineTo(x,y-s*8);ctx.stroke();ctx.strokeStyle=dark;ctx.lineWidth=s*1.5;for(let i=0;i<3;i++){const ry=y-s*(3+i*2.5);ctx.beginPath();ctx.moveTo(x,ry);ctx.bezierCurveTo(x-s*6,ry-s,x-s*5,ry+s*2,x-s*3,ry+s*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x,ry);ctx.bezierCurveTo(x+s*6,ry-s,x+s*5,ry+s*2,x+s*3,ry+s*2);ctx.stroke();}ctx.strokeStyle=bone;ctx.lineWidth=s*2;ctx.beginPath();ctx.moveTo(x-s*3,y-s*7);ctx.lineTo(x-s*8,y-s*3+walk);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*3,y-s*7);ctx.lineTo(x+s*8,y-s*3-walk);ctx.stroke();ctx.strokeStyle='#484e58';ctx.lineWidth=s*1.8;ctx.beginPath();ctx.moveTo(x+s*8,y-s*3-walk);ctx.lineTo(x+s*10,y-s*10-walk);ctx.stroke();_gf(x+s*10,y-s*10-walk,s*4,'#585e68');ctx.beginPath();ctx.moveTo(x+s*8,y-s*10-walk);ctx.lineTo(x+s*14,y-s*8-walk);ctx.lineTo(x+s*13,y-s*13-walk);ctx.lineTo(x+s*7,y-s*12-walk);ctx.closePath();ctx.fill();ctx.fillStyle='#8a9098';ctx.beginPath();ctx.moveTo(x+s*11,y-s*8.5-walk);ctx.lineTo(x+s*14,y-s*8-walk);ctx.lineTo(x+s*13,y-s*13-walk);ctx.closePath();ctx.fill();_ge(x,y-s*13,s*5,s*5.5,0,bone);_ge(x,y-s*9.5,s*3,s*2,0,'#7a7258');ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(x-s*2,y-s*14,s*1.8,s*2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+s*2,y-s*14,s*1.8,s*2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(220,70,0,0.85)';ctx.beginPath();ctx.ellipse(x-s*2,y-s*14,s*0.9,s*1.1,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+s*2,y-s*14,s*0.9,s*1.1,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(x,y-s*12,s*0.8,s*1,0,0,Math.PI*2);ctx.fill();}

function drawQuillRat(x,y,s){const sc=Math.sin(G.tick*0.2)*s*0.8;ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(x,y+s*4,s*8,s*2.5,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#6a5018';ctx.lineWidth=s*1.2;ctx.lineCap='round';const qb=[{x:-6,y:-1},{x:-4,y:-3},{x:-2,y:-4},{x:0,y:-4.5},{x:2,y:-4},{x:4,y:-3},{x:6,y:-1}];const qt=[{x:-9,y:-7},{x:-6,y:-10},{x:-3,y:-11},{x:0,y:-12},{x:3,y:-11},{x:6,y:-10},{x:9,y:-7}];qb.forEach((b,i)=>{const t=qt[i];ctx.beginPath();ctx.moveTo(x+b.x*s,y+b.y*s);ctx.lineTo(x+t.x*s,y+t.y*s);ctx.stroke();});ctx.strokeStyle='#4e3a10';ctx.lineWidth=s*0.8;[{x:-5,y:-2,tx:-7,ty:-7},{x:-1,y:-4,tx:-1,ty:-9},{x:3,y:-3,tx:5,ty:-8}].forEach(q=>{ctx.beginPath();ctx.moveTo(x+q.x*s,y+q.y*s);ctx.lineTo(x+q.tx*s,y+q.ty*s);ctx.stroke();});_ge(x,y+s*1,s*8,s*5,0,'#321806');_ge(x,y+s*2,s*7,s*3.5,0,'#1e1004');ctx.strokeStyle='#180a02';ctx.lineWidth=s*2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-s*5,y+s*4);ctx.lineTo(x-s*6,y+s*7+sc);ctx.stroke();ctx.beginPath();ctx.moveTo(x-s*2,y+s*5);ctx.lineTo(x-s*2,y+s*8-sc);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*2,y+s*5);ctx.lineTo(x+s*2,y+s*8+sc);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*5,y+s*4);ctx.lineTo(x+s*6,y+s*7-sc);ctx.stroke();_ge(x+s*7,y-s*1,s*4.5,s*3.5,0.15,'#3e2808');_ge(x+s*9.5,y-s*0.5,s*2.5,s*2,0.1,'#281806');ctx.fillStyle='#880000';ctx.beginPath();ctx.arc(x+s*8,y-s*2.5,s*1.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#000';ctx.beginPath();ctx.arc(x+s*8,y-s*2.5,s*0.6,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,0.35)';ctx.beginPath();ctx.arc(x+s*8.4,y-s*2.9,s*0.4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#806030';ctx.lineWidth=s*0.6;ctx.beginPath();ctx.moveTo(x+s*10,y-s*1);ctx.lineTo(x+s*13,y-s*0.5);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*10,y-s*1.5);ctx.lineTo(x+s*13,y-s*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*10,y-s*0.5);ctx.lineTo(x+s*13,y+s*0.5);ctx.stroke();ctx.strokeStyle='#1e1004';ctx.lineWidth=s*1.5;ctx.beginPath();ctx.moveTo(x-s*7,y+s*1);ctx.quadraticCurveTo(x-s*10,y-s*1,x-s*9,y-s*4);ctx.stroke();}

function drawDarkLord(x,y,s){const fl=Math.sin(G.tick*0.07)*s*2;ctx.fillStyle='rgba(50,0,70,0.4)';ctx.beginPath();ctx.ellipse(x,y+s*8,s*12,s*4,0,0,Math.PI*2);ctx.fill();_gf(x-s*9,y-s*5+fl,s*14,'#160018');ctx.beginPath();ctx.moveTo(x,y-s*8+fl);ctx.bezierCurveTo(x-s*8,y-s*13+fl,x-s*20,y-s*4+fl,x-s*18,y+s*2+fl);ctx.bezierCurveTo(x-s*14,y-s*1+fl,x-s*7,y-s*5+fl,x-s*2,y-s*7+fl);ctx.fill();_gf(x+s*9,y-s*5+fl,s*14,'#160018');ctx.beginPath();ctx.moveTo(x,y-s*8+fl);ctx.bezierCurveTo(x+s*8,y-s*13+fl,x+s*20,y-s*4+fl,x+s*18,y+s*2+fl);ctx.bezierCurveTo(x+s*14,y-s*1+fl,x+s*7,y-s*5+fl,x+s*2,y-s*7+fl);ctx.fill();ctx.strokeStyle='#2a0040';ctx.lineWidth=s;for(let i=1;i<=3;i++){ctx.beginPath();ctx.moveTo(x-s,y-s*7+fl);ctx.lineTo(x-s*5*i,y+s*(1-i)+fl);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s,y-s*7+fl);ctx.lineTo(x+s*5*i,y+s*(1-i)+fl);ctx.stroke();}_gf(x,y-s*6+fl,s*10,'#0e0014');ctx.beginPath();ctx.moveTo(x-s*5,y-s*14+fl);ctx.lineTo(x+s*5,y-s*14+fl);ctx.lineTo(x+s*7,y+s*2+fl);ctx.lineTo(x-s*7,y+s*2+fl);ctx.closePath();ctx.fill();ctx.strokeStyle='#200030';ctx.lineWidth=s*3;ctx.beginPath();ctx.moveTo(x-s*4,y-s*12+fl);ctx.lineTo(x-s*10,y-s*8+fl);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*4,y-s*12+fl);ctx.lineTo(x+s*10,y-s*8+fl);ctx.stroke();_ge(x,y-s*20+fl,s*5.5,s*6,0,'#180020');ctx.fillStyle='#7020a0';ctx.beginPath();ctx.moveTo(x-s*4,y-s*23+fl);ctx.lineTo(x-s*7,y-s*30+fl);ctx.lineTo(x-s*2,y-s*24+fl);ctx.fill();ctx.beginPath();ctx.moveTo(x+s*4,y-s*23+fl);ctx.lineTo(x+s*7,y-s*30+fl);ctx.lineTo(x+s*2,y-s*24+fl);ctx.fill();_ge(x-s*2,y-s*21+fl,s*2,s*1.8,0,'#cc0000');_ge(x+s*2,y-s*21+fl,s*2,s*1.8,0,'#cc0000');ctx.fillStyle='#ff5555';ctx.beginPath();ctx.arc(x-s*2,y-s*21.5+fl,s*0.8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*2,y-s*21.5+fl,s*0.8,0,Math.PI*2);ctx.fill();ctx.save();ctx.globalAlpha=0.09+0.06*Math.sin(G.tick*0.08);ctx.fillStyle='#8020b0';ctx.beginPath();ctx.arc(x,y-s*10+fl,s*18,0,Math.PI*2);ctx.fill();ctx.restore();}

function drawBoneGolem(x,y,s){const bob=Math.sin(G.tick*0.05)*s;const bone='#7a7258',dark='#484030';ctx.fillStyle='rgba(0,0,0,0.35)';ctx.beginPath();ctx.ellipse(x,y+s*8,s*10,s*4,0,0,Math.PI*2);ctx.fill();_ge(x-s*4,y+s*2+bob,s*4,s*6,0.2,bone);_ge(x+s*4,y+s*2+bob,s*4,s*6,-0.2,bone);ctx.fillStyle=dark;ctx.beginPath();ctx.ellipse(x-s*4,y+s*5+bob,s*3,s*2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+s*4,y+s*5+bob,s*3,s*2,0,0,Math.PI*2);ctx.fill();_ge(x,y-s*7+bob,s*9,s*10,0,bone);ctx.strokeStyle=dark;ctx.lineWidth=s*1.5;for(let i=0;i<4;i++){const ry=y-s*(1+i*2.5)+bob;ctx.beginPath();ctx.moveTo(x,ry);ctx.bezierCurveTo(x-s*9,ry-s,x-s*8,ry+s*2,x-s*4,ry+s*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x,ry);ctx.bezierCurveTo(x+s*9,ry-s,x+s*8,ry+s*2,x+s*4,ry+s*2);ctx.stroke();}_ge(x-s*11,y-s*7+bob,s*4,s*7,0.3,bone);_ge(x+s*11,y-s*7+bob,s*4,s*7,-0.3,bone);ctx.fillStyle=dark;ctx.beginPath();ctx.ellipse(x-s*13,y-s*11+bob,s*3,s*3,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+s*13,y-s*11+bob,s*3,s*3,0,0,Math.PI*2);ctx.fill();_ge(x,y-s*20+bob,s*7,s*7,0,bone);ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(x-s*2.5,y-s*21+bob,s*2,s*2.5,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+s*2.5,y-s*21+bob,s*2,s*2.5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(220,60,0,0.9)';ctx.beginPath();ctx.ellipse(x-s*2.5,y-s*21.5+bob,s*1,s*1.2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+s*2.5,y-s*21.5+bob,s*1,s*1.2,0,0,Math.PI*2);ctx.fill();}

function drawBloodRaven(x,y,s){const wf=Math.sin(G.tick*0.13)*s*5;ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(x,y+s*5,s*12,s*3,0,0,Math.PI*2);ctx.fill();_gf(x-s*9,y-s*6,s*14,'#100002');ctx.beginPath();ctx.moveTo(x-s*2,y-s*8);ctx.bezierCurveTo(x-s*12,y-s*14-wf,x-s*20,y-s*4-wf,x-s*16,y+s*2);ctx.bezierCurveTo(x-s*11,y-s*2,x-s*6,y-s*5,x-s*2,y-s*6);ctx.fill();_gf(x+s*9,y-s*6,s*14,'#100002');ctx.beginPath();ctx.moveTo(x+s*2,y-s*8);ctx.bezierCurveTo(x+s*12,y-s*14-wf,x+s*20,y-s*4-wf,x+s*16,y+s*2);ctx.bezierCurveTo(x+s*11,y-s*2,x+s*6,y-s*5,x+s*2,y-s*6);ctx.fill();ctx.strokeStyle='#380010';ctx.lineWidth=s*0.8;ctx.beginPath();ctx.moveTo(x-s*2,y-s*7);ctx.lineTo(x-s*14,y-s*6-wf*0.5);ctx.stroke();ctx.beginPath();ctx.moveTo(x-s*2,y-s*7);ctx.lineTo(x-s*10,y-s*1-wf*0.3);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*2,y-s*7);ctx.lineTo(x+s*14,y-s*6-wf*0.5);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*2,y-s*7);ctx.lineTo(x+s*10,y-s*1-wf*0.3);ctx.stroke();_gf(x,y-s*10,s*6,'#180408');ctx.beginPath();ctx.roundRect(x-s*4,y-s*14,s*8,s*10,s*2);ctx.fill();_gf(x,y-s*10,s*5,'#2e000e');ctx.beginPath();ctx.roundRect(x-s*3,y-s*13,s*6,s*7,s);ctx.fill();ctx.strokeStyle='#400012';ctx.lineWidth=s;ctx.beginPath();ctx.moveTo(x-s*3,y-s*10);ctx.lineTo(x+s*3,y-s*10);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y-s*14);ctx.lineTo(x,y-s*7);ctx.stroke();ctx.strokeStyle='#180408';ctx.lineWidth=s*3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-s*2,y-s*5);ctx.lineTo(x-s*3,y+s*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*2,y-s*5);ctx.lineTo(x+s*3,y+s*2);ctx.stroke();ctx.strokeStyle='#2e1000';ctx.lineWidth=s;ctx.beginPath();ctx.moveTo(x-s*3,y+s*2);ctx.lineTo(x-s*5,y+s*4);ctx.stroke();ctx.beginPath();ctx.moveTo(x-s*3,y+s*2);ctx.lineTo(x-s*2,y+s*4);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*3,y+s*2);ctx.lineTo(x+s*5,y+s*4);ctx.stroke();ctx.beginPath();ctx.moveTo(x+s*3,y+s*2);ctx.lineTo(x+s*2,y+s*4);ctx.stroke();_ge(x,y-s*21,s*5,s*6,0,'#583020');ctx.fillStyle='#080002';ctx.beginPath();ctx.moveTo(x-s*6,y-s*20);ctx.lineTo(x,y-s*32);ctx.lineTo(x+s*6,y-s*20);ctx.closePath();ctx.fill();ctx.beginPath();ctx.ellipse(x,y-s*22,s*5.5,s*5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ee1818';ctx.beginPath();ctx.ellipse(x-s*2,y-s*22,s*1.5,s*1.2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+s*2,y-s*22,s*1.5,s*1.2,0,0,Math.PI*2);ctx.fill();ctx.save();ctx.globalAlpha=0.28+0.18*Math.sin(G.tick*0.12);ctx.fillStyle='#cc0000';ctx.beginPath();ctx.arc(x-s*2,y-s*22,s*3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*2,y-s*22,s*3,0,Math.PI*2);ctx.fill();ctx.restore();}

function drawDuriel(x,y,s){const hv=Math.sin(G.tick*0.06)*s*1.5;const wr=Math.sin(G.tick*0.08)*s;ctx.fillStyle='rgba(60,30,0,0.45)';ctx.beginPath();ctx.ellipse(x,y+s*4,s*18,s*6,0,0,Math.PI*2);ctx.fill();const segColors=['#686030','#585228','#484018','#383010'];for(let i=0;i<4;i++){const sw=s*(14-i*2.5),sh=s*(5-i*0.3);const sy2=y+s*(2-i*4)+(i%2===0?wr:-wr)*0.5;ctx.fillStyle=segColors[i];ctx.beginPath();ctx.ellipse(x,sy2,sw,sh,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=segColors[Math.min(i+1,3)];ctx.lineWidth=s*1.2;ctx.beginPath();ctx.ellipse(x,sy2+sh*0.6,sw*0.85,s*1.5,0,0,Math.PI*2);ctx.stroke();}ctx.strokeStyle='#806030';ctx.lineWidth=s*1.5;ctx.lineCap='round';for(let i=0;i<3;i++){const lx=s*(10-i*2.5),ly=y+s*(3-i*4);ctx.beginPath();ctx.moveTo(x-lx,ly);ctx.lineTo(x-lx-s*3,ly+s*4);ctx.stroke();ctx.beginPath();ctx.moveTo(x+lx,ly);ctx.lineTo(x+lx+s*3,ly+s*4);ctx.stroke();}_ge(x,y-s*15+hv,s*13,s*14,0,'#686030');_ge(x-s*4,y-s*16+hv,s*5,s*7,-0.2,'#585228');_ge(x+s*4,y-s*16+hv,s*5,s*7,0.2,'#585228');ctx.strokeStyle='#484018';ctx.lineWidth=s*1.5;ctx.beginPath();ctx.moveTo(x,y-s*22+hv);ctx.lineTo(x,y-s*9+hv);ctx.stroke();_ge(x,y-s*27+hv,s*6,s*4,0,'#606030');_ge(x-s*15,y-s*18+hv,s*5,s*8,0.4,'#585228');_ge(x+s*15,y-s*18+hv,s*5,s*8,-0.4,'#585228');_gf(x-s*22,y-s*26+hv,s*12,'#b0aa70');ctx.beginPath();ctx.moveTo(x-s*18,y-s*13+hv);ctx.bezierCurveTo(x-s*28,y-s*20+hv,x-s*30,y-s*32+hv,x-s*20,y-s*36+hv);ctx.bezierCurveTo(x-s*16,y-s*38+hv,x-s*14,y-s*34+hv,x-s*18,y-s*28+hv);ctx.bezierCurveTo(x-s*22,y-s*22+hv,x-s*20,y-s*16+hv,x-s*18,y-s*13+hv);ctx.fill();ctx.fillStyle='#d8d090';ctx.beginPath();ctx.moveTo(x-s*28,y-s*20+hv);ctx.bezierCurveTo(x-s*30,y-s*32+hv,x-s*20,y-s*36+hv,x-s*18,y-s*29+hv);ctx.bezierCurveTo(x-s*21,y-s*23+hv,x-s*26,y-s*19+hv,x-s*28,y-s*20+hv);ctx.fill();_gf(x+s*22,y-s*26+hv,s*12,'#b0aa70');ctx.beginPath();ctx.moveTo(x+s*18,y-s*13+hv);ctx.bezierCurveTo(x+s*28,y-s*20+hv,x+s*30,y-s*32+hv,x+s*20,y-s*36+hv);ctx.bezierCurveTo(x+s*16,y-s*38+hv,x+s*14,y-s*34+hv,x+s*18,y-s*28+hv);ctx.bezierCurveTo(x+s*22,y-s*22+hv,x+s*20,y-s*16+hv,x+s*18,y-s*13+hv);ctx.fill();ctx.fillStyle='#d8d090';ctx.beginPath();ctx.moveTo(x+s*28,y-s*20+hv);ctx.bezierCurveTo(x+s*30,y-s*32+hv,x+s*20,y-s*36+hv,x+s*18,y-s*29+hv);ctx.bezierCurveTo(x+s*21,y-s*23+hv,x+s*26,y-s*19+hv,x+s*28,y-s*20+hv);ctx.fill();_ge(x,y-s*34+hv,s*10,s*9,0,'#5e5828');_gf(x,y-s*25+hv,s*10,'#4e4c20');ctx.beginPath();ctx.moveTo(x-s*8,y-s*28+hv);ctx.bezierCurveTo(x-s*10,y-s*22+hv,x-s*6,y-s*20+hv,x,y-s*22+hv);ctx.bezierCurveTo(x+s*6,y-s*20+hv,x+s*10,y-s*22+hv,x+s*8,y-s*28+hv);ctx.fill();ctx.fillStyle='#c8c080';for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(x+i*s*2-s,y-s*24+hv);ctx.lineTo(x+i*s*2,y-s*21+hv);ctx.lineTo(x+i*s*2+s,y-s*24+hv);ctx.fill();}ctx.fillStyle='#383010';for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(x+i*s*3-s,y-s*41+hv);ctx.lineTo(x+i*s*3,y-s*46+hv);ctx.lineTo(x+i*s*3+s,y-s*41+hv);ctx.fill();}const eyes=[[-s*4,y-s*37+hv],[s*4,y-s*37+hv],[-s*7,y-s*33+hv],[s*7,y-s*33+hv],[0,y-s*40+hv]];eyes.forEach(([ex,ey])=>{ctx.fillStyle='#200000';ctx.beginPath();ctx.ellipse(x+ex,ey,s*2.2,s*2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff3000';ctx.beginPath();ctx.ellipse(x+ex,ey,s*1.6,s*1.5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffaa00';ctx.beginPath();ctx.ellipse(x+ex,ey,s*0.7,s*0.7,0,0,Math.PI*2);ctx.fill();});ctx.save();ctx.globalAlpha=0.1+0.06*Math.sin(G.tick*0.07);ctx.fillStyle='#c0a000';ctx.beginPath();ctx.arc(x,y-s*20+hv,s*28,0,Math.PI*2);ctx.fill();ctx.restore();}

function drawEnemySprite(en,sx,sy){const s=en.size/16;const bob=en.state==='chase'?Math.sin(G.tick*0.12+en.x)*2:Math.sin(G.tick*0.04)*0.5;const cy=sy+bob;ctx.save();if(en.frozen>0)ctx.filter='hue-rotate(160deg) brightness(1.3) saturate(0.6)';switch(en.name){case 'Fallen':drawFallen(sx,cy,s);break;case 'Zombie':drawZombie(sx,cy,s);break;case 'Skeleton':drawSkeleton(sx,cy,s);break;case 'Quill Rat':drawQuillRat(sx,cy,s);break;case 'Dark Lord':drawDarkLord(sx,cy,s);break;case 'Bone Golem':drawBoneGolem(sx,cy,s);break;case 'Blood Raven':drawBloodRaven(sx,cy,s);break;case 'Duriel':drawDuriel(sx,cy,s);break;default:ctx.fillStyle=en.color;ctx.beginPath();ctx.arc(sx,cy,en.size,0,Math.PI*2);ctx.fill();}ctx.restore();}

function drawMinionSprite(mn,sx,sy){ctx.save();const s=mn.isGolem?1.4:0.9;if(mn.isGolem)drawBoneGolem(sx,sy,s);else drawSkeleton(sx,sy,s);ctx.restore();}

function drawBarbarian(x,y,s){const ang=G.player?G.player.facingAngle:0;const mov=G.player?G.player.moving:false;const flip=(Math.cos(ang)-Math.sin(ang)>=0)?1:-1;const wp=mov?G.tick*0.22:0;const aw=Math.sin(wp)*(mov?8:3);const ls=Math.sin(wp)*s*(mov?4:0.8);const rs=-ls;ctx.save();ctx.translate(x,y);ctx.scale(flip,1);ctx.translate(-x,-y);ctx.fillStyle='rgba(0,0,0,0.35)';ctx.beginPath();ctx.ellipse(x,y+s*2,s*15,s*5,0,0,Math.PI*2);ctx.fill();_ge(x-s*5,y+s*3+ls,s*3.5,s*6,ls*0.02,'#3c2010');_ge(x+s*5,y+s*3+rs,s*3.5,s*6,rs*0.02,'#3c2010');ctx.fillStyle='#241208';ctx.beginPath();ctx.ellipse(x-s*5,y+s*8+ls*0.6,s*3,s*2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+s*5,y+s*8+rs*0.6,s*3,s*2,0,0,Math.PI*2);ctx.fill();_gf(x-s*5,y+s*4,s*7,'#1e0e04');ctx.beginPath();ctx.roundRect(x-s*8+aw*0.3,y+s*2,s*6,s*5,s);ctx.fill();ctx.beginPath();ctx.roundRect(x+s*2-aw*0.3,y+s*2,s*6,s*5,s);ctx.fill();ctx.fillStyle='#3a2010';ctx.beginPath();ctx.roundRect(x-s*8+aw*0.3,y+s*2,s*6,s*2,s);ctx.fill();ctx.beginPath();ctx.roundRect(x+s*2-aw*0.3,y+s*2,s*6,s*2,s);ctx.fill();_gf(x-s*5,y-s*2,s*7,'#2e1808');ctx.beginPath();ctx.roundRect(x-s*8,y-s*7,s*6,s*10,s*2);ctx.fill();ctx.beginPath();ctx.roundRect(x+s*2,y-s*7,s*6,s*10,s*2);ctx.fill();ctx.fillStyle='#201004';ctx.fillRect(x-s*9,y-s*9,s*18,s*3);_ge(x,y-s*9,s*3,s*1.5,0,'#a07810');_ge(x,y-s*18,s*11,s*12,0,'#7a3e18');_ge(x-s*4,y-s*20,s*4,s*5,-0.15,'#5e2e10');_ge(x+s*4,y-s*20,s*4,s*5,0.15,'#5e2e10');ctx.strokeStyle='#501e08';ctx.lineWidth=s*1.2;ctx.beginPath();ctx.moveTo(x,y-s*25);ctx.lineTo(x,y-s*10);ctx.stroke();ctx.beginPath();ctx.moveTo(x-s*5,y-s*15);ctx.lineTo(x+s*5,y-s*15);ctx.stroke();ctx.beginPath();ctx.moveTo(x-s*5,y-s*12);ctx.lineTo(x+s*5,y-s*12);ctx.stroke();ctx.strokeStyle='#201004';ctx.lineWidth=s*2;ctx.beginPath();ctx.moveTo(x-s*11,y-s*22);ctx.lineTo(x+s*5,y-s*10);ctx.stroke();_ge(x-s*12,y-s*20,s*5,s*7,-0.2,'#3e2010');_ge(x+s*12,y-s*20,s*5,s*7,0.2,'#3e2010');_ge(x-s*12,y-s*23,s*4.5,s*4,0,'#281608');_ge(x+s*12,y-s*23,s*4.5,s*4,0,'#281608');_gf(x-s*14,y-s*18,s*8,'#7a3e18');ctx.beginPath();ctx.roundRect(x-s*17,y-s*25+aw,s*6,s*14,s*3);ctx.fill();ctx.beginPath();ctx.roundRect(x+s*11,y-s*25-aw,s*6,s*14,s*3);ctx.fill();ctx.fillStyle='#201004';ctx.beginPath();ctx.roundRect(x-s*17,y-s*13+aw,s*6,s*3,s);ctx.fill();ctx.beginPath();ctx.roundRect(x+s*11,y-s*13-aw,s*6,s*3,s);ctx.fill();ctx.strokeStyle='#383838';ctx.lineWidth=s*2.5;ctx.beginPath();ctx.moveTo(x+s*14,y-s*22-aw);ctx.lineTo(x+s*17,y-s*36-aw);ctx.stroke();_gf(x+s*15,y-s*35-aw,s*6,'#505860');ctx.beginPath();ctx.moveTo(x+s*11,y-s*35-aw);ctx.lineTo(x+s*20,y-s*30-aw);ctx.lineTo(x+s*19,y-s*40-aw);ctx.lineTo(x+s*10,y-s*38-aw);ctx.closePath();ctx.fill();ctx.fillStyle='#8898a8';ctx.beginPath();ctx.moveTo(x+s*16,y-s*31-aw);ctx.lineTo(x+s*20,y-s*30-aw);ctx.lineTo(x+s*19,y-s*40-aw);ctx.lineTo(x+s*15,y-s*38-aw);ctx.closePath();ctx.fill();_ge(x,y-s*27,s*3,s*2,0,'#7a3e18');_ge(x,y-s*33,s*7,s*8,0,'#7a3e18');_gf(x,y-s*36,s*8,'#201008');ctx.beginPath();ctx.ellipse(x,y-s*35,s*7.5,s*5,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.roundRect(x-s*7,y-s*37,s*14,s*4,s);ctx.fill();_gf(x-s*12,y-s*34,s*6,'#180c04');ctx.beginPath();ctx.moveTo(x-s*7,y-s*37);ctx.bezierCurveTo(x-s*14,y-s*38,x-s*18,y-s*35,x-s*15,y-s*29);ctx.lineTo(x-s*11,y-s*30);ctx.bezierCurveTo(x-s*13,y-s*35,x-s*11,y-s*37,x-s*6,y-s*36);ctx.fill();_gf(x+s*12,y-s*34,s*6,'#180c04');ctx.beginPath();ctx.moveTo(x+s*7,y-s*37);ctx.bezierCurveTo(x+s*14,y-s*38,x+s*18,y-s*35,x+s*15,y-s*29);ctx.lineTo(x+s*11,y-s*30);ctx.bezierCurveTo(x+s*13,y-s*35,x+s*11,y-s*37,x+s*6,y-s*36);ctx.fill();_ge(x,y-s*31,s*5.5,s*5,0,'#7a3818');ctx.fillStyle='#880808';ctx.fillRect(x-s*6,y-s*33,s*12,s*2.5);_ge(x-s*2,y-s*32,s*1.5,s*1.3,0,'#d4a800');_ge(x+s*2,y-s*32,s*1.5,s*1.3,0,'#d4a800');ctx.fillStyle='#000';ctx.beginPath();ctx.arc(x-s*2,y-s*32,s*0.7,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+s*2,y-s*32,s*0.7,0,Math.PI*2);ctx.fill();_ge(x,y-s*27.5,s*4,s*4,0,'#140a02');_gf(x,y-s*26,s*5,'#1e1006');ctx.beginPath();ctx.moveTo(x-s*4,y-s*28);ctx.bezierCurveTo(x-s*3,y-s*23,x+s*3,y-s*23,x+s*4,y-s*28);ctx.fill();ctx.restore();}

function drawFloorTile(sx,sy,tx,ty){const hw=ISO_W/2,hh=ISO_H/2;const varKeys=['ground','ground_var1','ground_var2','ground','ground','ground_dark'];const tileKey=varKeys[(tx*7+ty*13)%varKeys.length];const timg=IMGS[tileKey];if(timg&&timg.complete&&timg.naturalWidth){ctx.save();ctx.beginPath();ctx.moveTo(sx,sy-hh);ctx.lineTo(sx+hw,sy);ctx.lineTo(sx,sy+hh);ctx.lineTo(sx-hw,sy);ctx.closePath();ctx.clip();const N=timg.naturalWidth;ctx.transform(hw/N,hh/N,-hw/N,hh/N,sx,sy-hh);ctx.drawImage(timg,0,0);ctx.restore();return;}ctx.beginPath();ctx.moveTo(sx,sy-hh);ctx.lineTo(sx+hw,sy);ctx.lineTo(sx,sy+hh);ctx.lineTo(sx-hw,sy);ctx.closePath();const v=(tx*17+ty*13)%5;const baseColors=['#1c1409','#191208','#1a1308','#181108','#1b1509'];ctx.fillStyle=baseColors[v];ctx.fill();ctx.strokeStyle='#100d07';ctx.lineWidth=0.5;ctx.stroke();}

function drawWallTile(sx,sy,tx,ty){const hw=ISO_W/2,hh=ISO_H/2,wh=WALL_H;ctx.beginPath();ctx.moveTo(sx-hw,sy);ctx.lineTo(sx,sy+hh);ctx.lineTo(sx,sy+hh-wh);ctx.lineTo(sx-hw,sy-wh);ctx.closePath();const lg=ctx.createLinearGradient(sx-hw,sy-wh/2,sx,sy-wh/2);lg.addColorStop(0,'#242014');lg.addColorStop(1,'#14100a');ctx.fillStyle=lg;ctx.fill();ctx.strokeStyle='#080604';ctx.lineWidth=0.5;ctx.stroke();ctx.beginPath();ctx.moveTo(sx,sy+hh);ctx.lineTo(sx+hw,sy);ctx.lineTo(sx+hw,sy-wh);ctx.lineTo(sx,sy+hh-wh);ctx.closePath();const rg=ctx.createLinearGradient(sx,sy,sx+hw,sy-wh);rg.addColorStop(0,'#181408');rg.addColorStop(1,'#0e0c06');ctx.fillStyle=rg;ctx.fill();ctx.strokeStyle='#080604';ctx.lineWidth=0.5;ctx.stroke();const wallIdx=(tx*17+ty*13)%3+1;const wimg=IMGS[`wall${wallIdx}_SE`];if(wimg&&wimg.complete&&wimg.naturalWidth){ctx.save();ctx.beginPath();ctx.moveTo(sx,sy-hh-wh);ctx.lineTo(sx+hw,sy-wh);ctx.lineTo(sx,sy+hh-wh);ctx.lineTo(sx-hw,sy-wh);ctx.closePath();ctx.clip();const N=wimg.naturalWidth;ctx.transform(hw/N,hh/N,-hw/N,hh/N,sx,sy-hh-wh);ctx.drawImage(wimg,0,0);ctx.restore();}else{const topC=['#2e2614','#2a2212','#322a16'][(tx*17+ty*13)%3];ctx.beginPath();ctx.moveTo(sx,sy-hh-wh);ctx.lineTo(sx+hw,sy-wh);ctx.lineTo(sx,sy+hh-wh);ctx.lineTo(sx-hw,sy-wh);ctx.closePath();ctx.fillStyle=topC;ctx.fill();ctx.strokeStyle='#0c0a06';ctx.lineWidth=0.5;ctx.stroke();}}

function render() {
  const p = G.player;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#050302'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const drawables = [];

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const [sx, sy] = w2s((tx + 0.5)*TILE, (ty + 0.5)*TILE);
      if (sx < -ISO_W || sx > canvas.width + ISO_W || sy < -WALL_H - ISO_H || sy > canvas.height + ISO_H) continue;
      const tile = G.map.tiles[ty]?.[tx] ?? 1;
      const depth = tx + ty + 0.01;
      if (tile === 0) {
        drawables.push({ depth, fn: () => { drawFloorTile(sx, sy, tx, ty); }});
      } else {
        drawables.push({ depth, fn: () => drawWallTile(sx, sy, tx, ty) });
      }
    }
  }

  if (!G.inHub && G.portalOpen) {
    const [psx2, psy2] = w2s(G.portalX, G.portalY);
    const pdepth = G.portalX/TILE + G.portalY/TILE;
    drawables.push({ depth: pdepth, fn: () => {
      const pulse = 0.8 + 0.2*Math.sin(G.tick*0.08);
      ctx.save(); ctx.globalAlpha = 0.85;
      const grad = ctx.createRadialGradient(psx2, psy2, 0, psx2, psy2, 30*pulse);
      grad.addColorStop(0,'#c060ff'); grad.addColorStop(0.5,'#6020a0'); grad.addColorStop(1,'transparent');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(psx2, psy2-10, 28*pulse, 18*pulse, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#e0a0ff'; ctx.font = '11px Georgia'; ctx.textAlign = 'center';
      ctx.fillText('Exit Portal', psx2, psy2 - 40); ctx.restore();
    }});
  }

  if (G.inHub) {
    G.hubObjects.forEach(obj => {
      const [osx, osy] = w2s(obj.x, obj.y);
      const objDepth = obj.x/TILE + obj.y/TILE + 0.5;
      drawables.push({ depth: objDepth, fn: () => {
        const isNear = G.nearHubObject === obj;
        switch(obj.type) {
          case 'campfire': {
            const frame = Math.floor(G.tick / 5) % 8;
            const bImg = IMGS[`brazier_lit_SE_${frame}`];
            if (bImg && bImg.complete && bImg.naturalWidth) { drawSpr(`brazier_lit_SE_${frame}`, osx, osy, 1, SP_AY); }
            else { ctx.fillStyle = `rgba(255,${90+Math.sin(G.tick*0.15)*40|0},0,0.9)`; ctx.beginPath(); ctx.arc(osx, osy-18, 10+Math.sin(G.tick*0.1)*2, 0, Math.PI*2); ctx.fill(); }
            ctx.save(); ctx.globalAlpha = 0.10 + 0.05*Math.sin(G.tick*0.09);
            const glow = ctx.createRadialGradient(osx, osy-15, 0, osx, osy-15, 90);
            glow.addColorStop(0,'rgba(255,130,20,1)'); glow.addColorStop(1,'rgba(255,130,20,0)');
            ctx.fillStyle = glow; ctx.fillRect(osx-90, osy-105, 180, 180); ctx.restore();
            break;
          }
          case 'merchant': {
            const nf = Math.floor(G.tick / 8) % 6;
            const nImg = IMGS[`npc_work_${nf}`];
            if (nImg && nImg.complete && nImg.naturalWidth) { drawSpr(`npc_work_${nf}`, osx, osy, 1, SP_AY); }
            else { ctx.fillStyle='#8b6a20'; ctx.beginPath(); ctx.arc(osx, osy-30, 12, 0, Math.PI*2); ctx.fill(); ctx.fillStyle='#5a4010'; ctx.beginPath(); ctx.roundRect(osx-10, osy-22, 20, 24, 3); ctx.fill(); }
            break;
          }
          case 'stash': {
            const bImg2 = IMGS['barrel_SE'];
            if (bImg2 && bImg2.complete && bImg2.naturalWidth) { drawSpr('barrel_SE', osx, osy, 1, SP_AY); }
            else { ctx.fillStyle='#7a5010'; ctx.fillRect(osx-18, osy-26, 36, 26); ctx.fillStyle='#5a3a08'; ctx.fillRect(osx-18, osy-26, 36, 8); ctx.fillStyle='#c8a030'; ctx.fillRect(osx-3, osy-16, 6, 6); }
            break;
          }
          case 'shrine': {
            ctx.save(); ctx.globalAlpha = 0.55 + 0.3*Math.sin(G.tick*0.08);
            const sg = ctx.createRadialGradient(osx, osy-28, 0, osx, osy-28, 28);
            sg.addColorStop(0,'rgba(255,215,0,0.9)'); sg.addColorStop(1,'rgba(255,215,0,0)');
            ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(osx, osy-28, 28, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1; ctx.fillStyle='#c8a030'; ctx.beginPath(); ctx.arc(osx, osy-28, 13, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle='#ffd700'; ctx.font='bold 14px Georgia'; ctx.textAlign='center'; ctx.fillText('✦', osx, osy-23); ctx.restore();
            break;
          }
          case 'portal': {
            const pulse = 0.8 + 0.2*Math.sin(G.tick*0.08);
            ctx.save(); ctx.globalAlpha = 0.9;
            const pg = ctx.createRadialGradient(osx, osy, 0, osx, osy, 38*pulse);
            pg.addColorStop(0,'#c060ff'); pg.addColorStop(0.5,'#6020a0'); pg.addColorStop(1,'transparent');
            ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(osx, osy-12, 34*pulse, 24*pulse, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
            break;
          }
        }
        ctx.save(); ctx.fillStyle = isNear ? '#ffd700' : '#c8a96e'; ctx.font = (isNear?'bold ':'')+'11px Georgia';
        ctx.textAlign = 'center'; ctx.globalAlpha = isNear ? 1 : 0.65;
        ctx.fillText(obj.label, osx, osy - 48); ctx.restore();
      }});
    });
  }

  G.props.forEach(prop => {
    const [psx, psy] = w2s(prop.x, prop.y);
    if (psx < -120 || psx > canvas.width+120 || psy < -200 || psy > canvas.height+120) return;
    const depth = prop.x/TILE + prop.y/TILE + 0.4;
    drawables.push({ depth, fn: () => {
      let key = prop.key;
      if (prop.anim) { const f = Math.floor(G.tick / (prop.fps || 5)) % prop.frames; key = `${prop.anim}_${f}`; }
      const drawn = drawSpr(key, psx, psy, 1, SP_AY);
      if (!drawn) { ctx.fillStyle = '#5a4010'; ctx.beginPath(); ctx.arc(psx, psy - 10, 6, 0, Math.PI*2); ctx.fill(); }
    }});
  });

  G.lootDrops.forEach(drop => {
    const [lsx, lsy] = w2s(drop.x, drop.y);
    if (lsx < -100 || lsx > canvas.width+100 || lsy < -100 || lsy > canvas.height+100) return;
    const item = drop.item;
    const isGold = item.type === 'gold';
    const rarity = item.rarity || 'normal';
    drawables.push({ depth: drop.x/TILE + drop.y/TILE - 0.3, fn: () => {
      const himg = IMGS['highlight'];
      if (himg && himg.complete && himg.naturalWidth) {
        ctx.save();
        ctx.globalAlpha = isGold ? 0.35 : { normal:0.18, magic:0.45, rare:0.55, unique:0.7 }[rarity] || 0.18;
        const hue = isGold ? 0 : { normal:0, magic:195, rare:0, unique:30 }[rarity] || 0;
        if (hue) ctx.filter = `hue-rotate(${hue}deg)`;
        ctx.drawImage(himg, lsx - 50, lsy - 26, 100, 52); ctx.restore();
      }
      if (isGold) {
        const gf = Math.floor(G.tick / 10) % 8;
        const gimg = IMGS[`gold_SE_${gf}`];
        if (gimg && gimg.complete && gimg.naturalWidth) ctx.drawImage(gimg, lsx - 30, lsy - 44, 60, 60);
      }
      const glintOff = Math.floor((drop.x * 7 + drop.y * 13) % 120);
      const gPhase = (G.tick + glintOff) % 140;
      if (gPhase < 48) {
        const gf2 = Math.floor(gPhase / 6);
        const gimg2 = IMGS[`glint_${gf2}`];
        if (gimg2 && gimg2.complete && gimg2.naturalWidth) {
          ctx.save();
          ctx.globalAlpha = isGold ? 0.85 : { normal:0.25, magic:0.5, rare:0.7, unique:0.95 }[rarity] || 0.25;
          ctx.drawImage(gimg2, lsx - 40, lsy - 60, 80, 80); ctx.restore();
        }
      }
    }});
  });

  G.particles.forEach(pt => {
    const [sx, sy] = w2s(pt.x, pt.y);
    drawables.push({ depth: pt.x/TILE + pt.y/TILE + 0.5, fn: () => {
      ctx.globalAlpha = pt.life/40; ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(sx, sy, pt.size, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
    }});
  });

  G.slashEffects.forEach(s => {
    const [sx, sy] = w2s(s.x, s.y);
    const alpha = s.life/s.maxLife;
    drawables.push({ depth: s.x/TILE + s.y/TILE + 0.5, fn: () => {
      ctx.save();
      ctx.globalAlpha = alpha*0.85; ctx.strokeStyle = s.color; ctx.lineWidth = 3+alpha*2; ctx.lineCap = 'round';
      ctx.translate(sx, sy); ctx.rotate(s.angle);
      ctx.beginPath(); ctx.arc(0, 0, 22, -Math.PI/3, Math.PI/3); ctx.stroke();
      ctx.globalAlpha = alpha*0.3; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 22, -Math.PI/3, Math.PI/3); ctx.stroke();
      ctx.restore();
    }});
  });
  G.slashEffects = G.slashEffects.filter(s => { s.life--; return s.life > 0; });

  G.projectiles.forEach(proj => {
    const [sx, sy] = w2s(proj.x, proj.y);
    drawables.push({ depth: proj.x/TILE + proj.y/TILE + 0.5, fn: () => {
      ctx.fillStyle = proj.color; ctx.beginPath(); ctx.arc(sx, sy, proj.size, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(sx - proj.vx*2, sy - proj.vy*2, proj.size*0.6, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
    }});
  });

  G.minions.forEach(mn => {
    const [sx, sy] = w2s(mn.x, mn.y);
    drawables.push({ depth: mn.x/TILE + mn.y/TILE, fn: () => {
      drawMinionSprite(mn, sx, sy);
      const bw = 28, hpPct = mn.hp/mn.maxHp;
      ctx.fillStyle = '#333'; ctx.fillRect(sx-bw/2, sy-22, bw, 4);
      ctx.fillStyle = '#40a040'; ctx.fillRect(sx-bw/2, sy-22, bw*hpPct, 4);
    }});
  });

  G.enemies.forEach(en => {
    if (en.dead) return;
    const [sx, sy] = w2s(en.x, en.y);
    if (sx < -80 || sx > canvas.width+80 || sy < -100 || sy > canvas.height+100) return;
    drawables.push({ depth: en.x/TILE + en.y/TILE, fn: () => {
      let usedSprite = false;
      let sprAY = SP_AY;
      if (en.name === 'Skeleton') {
        sprAY = SK_AY;
        if (en.dying) {
          usedSprite = drawSpr(`skeleton_death_${en.deathDir}_${en.deathFrame}`, sx, sy, null, SK_AY);
        } else {
          const enAngle = G.player ? Math.atan2(G.player.y - en.y, G.player.x - en.x) : 0;
          const dir = isoDir(enAngle);
          const frame = Math.floor(G.tick / 6) % 8;
          usedSprite = drawSpr(`skeleton_walk_${dir}_${frame}`, sx, sy, null, SK_AY);
        }
      }
      if (!usedSprite) drawEnemySprite(en, sx, sy);
      if (!en.dying) {
        const bw = en.boss ? 90 : Math.max(44, en.size * 2.4);
        const bh = en.boss ? 8 : 6;
        const hpPct = Math.max(0, en.hp / en.maxHp);
        const barX = sx - bw / 2;
        const barY = sy - (usedSprite ? 80 : Math.max(30, en.size * 1.5 + 8));

        // bar fill colour: green → yellow → red
        const barColor = hpPct > 0.6 ? '#26d448' : hpPct > 0.3 ? '#f5c518' : '#e02010';

        // drop shadow behind the whole block
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 4;

        // dark trough
        ctx.fillStyle = '#1c0a0a';
        ctx.beginPath();
        ctx.roundRect(barX, barY, bw, bh, 3);
        ctx.fill();

        // coloured fill
        if (hpPct > 0) {
          ctx.fillStyle = barColor;
          ctx.beginPath();
          ctx.roundRect(barX, barY, bw * hpPct, bh, hpPct < 1 ? [3, 1, 1, 3] : 3);
          ctx.fill();

          // subtle highlight stripe on top half of fill
          ctx.fillStyle = 'rgba(255,255,255,0.14)';
          ctx.beginPath();
          ctx.roundRect(barX, barY, bw * hpPct, bh / 2, hpPct < 1 ? [3, 1, 0, 0] : [3, 3, 0, 0]);
          ctx.fill();
        }

        // border
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(barX, barY, bw, bh, 3);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // hp numbers (current / max) — centred just above the bar
        ctx.font = `bold ${en.boss ? 10 : 9}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fillText(`${en.hp} / ${en.maxHp}`, sx, barY - 2);

        // enemy name above the hp numbers
        const nameColor = en.boss ? '#ffd700' : '#c8b89a';
        ctx.font = en.boss ? 'bold 11px Georgia' : '10px Georgia';
        ctx.fillStyle = nameColor;
        ctx.shadowBlur = 4;
        ctx.fillText(en.name, sx, barY - (en.boss ? 14 : 13));

        ctx.shadowBlur = 0;
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
      }
    }});
  });

  const [psx, psy] = w2s(p.x, p.y);
  const pFlash = p.invincible>0 && !p.shieldTimer && Math.floor(G.tick/3)%2===0;
  const pAlpha = pFlash ? 0.4 : 1;
  const pDir = isoDir(p.facingAngle);
  const pFrame = p.moving ? Math.floor(G.tick / 5) % 8 : 0;
  const pCls = p.cls || 'warrior';
  const pSprKey = p.moving ? `${pCls}_walk_${pDir}_${pFrame}` : `${pCls}_idle_${pDir}`;
  drawables.push({ depth: p.x/TILE + p.y/TILE, fn: () => {
    const drew = drawSpr(pSprKey, psx, psy, pAlpha);
    if (!drew) {
      ctx.save(); ctx.globalAlpha = pAlpha;
      drawBarbarian(psx, psy, 1);
      ctx.restore();
    }
    if (p.buffTimer>0) { ctx.save(); ctx.globalAlpha=0.3+0.1*Math.sin(G.tick*0.15); ctx.strokeStyle='#ffaa00'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(psx, psy-SP_AY/2, 32, 0, Math.PI*2); ctx.stroke(); ctx.restore(); }
    if (p.shieldTimer>0) { ctx.save(); ctx.globalAlpha=0.25+0.15*Math.sin(G.tick*0.12); ctx.strokeStyle='#80c0ff'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(psx, psy-SP_AY/2, 36, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha=0.08; ctx.fillStyle='#80c0ff'; ctx.fill(); ctx.restore(); }
  }});

  drawables.sort((a, b) => a.depth - b.depth);
  drawables.forEach(d => d.fn());

  if (G.inHub) {
    const vig = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)*0.75);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(0.55,'rgba(0,0,0,0.08)'); vig.addColorStop(1,'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const lightR = 310 + 15*Math.sin(G.tick*0.04);
    const dark = ctx.createRadialGradient(psx, psy, 0, psx, psy, lightR);
    dark.addColorStop(0,'rgba(0,0,0,0)'); dark.addColorStop(0.45,'rgba(0,0,0,0.12)');
    dark.addColorStop(0.72,'rgba(0,0,0,0.68)'); dark.addColorStop(1,'rgba(0,0,0,0.97)');
    ctx.fillStyle = dark; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const torch = ctx.createRadialGradient(psx, psy, 0, psx, psy, lightR*0.6);
    torch.addColorStop(0,'rgba(140,70,10,0.18)'); torch.addColorStop(0.5,'rgba(100,45,5,0.08)'); torch.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = torch; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  mm.fillStyle = '#0a0806'; mm.fillRect(0, 0, 120, 90);
  const scaleX = 120/(COLS*TILE), scaleY = 90/(ROWS*TILE);
  G.map.tiles.forEach((row,ty) => row.forEach((tile,tx) => { if(tile===0){mm.fillStyle=G.inHub?'#2a3a20':'#3a2510';mm.fillRect(tx*TILE*scaleX,ty*TILE*scaleY,TILE*scaleX+1,TILE*scaleY+1);} }));
  if (G.inHub) {
    const hubColors = {campfire:'#ff8020',merchant:'#c8a030',stash:'#6080c0',shrine:'#ffd700',portal:'#c060ff'};
    G.hubObjects.forEach(obj=>{ mm.fillStyle=hubColors[obj.type]||'#888'; mm.fillRect(obj.x*scaleX-2,obj.y*scaleY-2,5,5); });
  } else {
    const aliveEnemies = G.enemies.filter(e=>!e.dead);
    if (aliveEnemies.length <= 3) {
      aliveEnemies.forEach(en=>{ mm.fillStyle=en.boss?'#ffd700':'#ff4040'; mm.fillRect(en.x*scaleX-2,en.y*scaleY-2,5,5); });
    }
    if (G.portalOpen) { mm.fillStyle='#c060ff'; mm.fillRect(G.portalX*scaleX-2,G.portalY*scaleY-2,5,5); }
  }
  mm.fillStyle = '#ffd700'; mm.fillRect(p.x*scaleX-2, p.y*scaleY-2, 5, 5);
}

// ── Engine initializer — called once from React useEffect after DOM is ready ──
export function initEngine() {
  canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d');
  mm = (document.getElementById('minimap') as HTMLCanvasElement).getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 90;
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 90;
  });

  loadSprites();

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    [mouseWorld.x, mouseWorld.y] = s2w(e.clientX - rect.left, e.clientY - rect.top);
    if (isMouseDown) handleLeftMouse(mouseWorld.x, mouseWorld.y);
  });
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    isMouseDown = true;
    const rect = canvas.getBoundingClientRect();
    const [wx, wy] = s2w(e.clientX - rect.left, e.clientY - rect.top);
    handleLeftMouse(wx, wy);
  });
  canvas.addEventListener('mouseup',    e => { if (e.button === 0) isMouseDown = false; });
  canvas.addEventListener('mouseleave', () => { isMouseDown = false; });
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!G.player) return;
    const rect = canvas.getBoundingClientRect();
    const [wx, wy] = s2w(e.clientX - rect.left, e.clientY - rect.top);
    useSkill(G.selectedSkill, wx, wy);
  });

  document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (!G.player) return;
    if (e.key === 'i' || e.key === 'I') toggleInventory();
    if (e.key === '1') { G.selectedSkill = -1; updateSkillBar(); }
    if (e.key === '2') { G.selectedSkill = 0; updateSkillBar(); }
    if (e.key === '3') { G.selectedSkill = 1; updateSkillBar(); }
    if (e.key === '4') { G.selectedSkill = 2; updateSkillBar(); }
    if (e.key === '5') { G.selectedSkill = 3; updateSkillBar(); }
    if (e.key === 'q' || e.key === 'Q') usePotionBelt(0);
    if (e.key === 'e' || e.key === 'E') usePotionBelt(1);
    if (e.key === 'f' || e.key === 'F') {
      if (G.inHub) interactHub();
      else if (G.nearPortal) showDepthChoice();
      else if (G.nearLoot) pickupLoot(G.nearLoot.id);
    }
    if (e.key === 't' || e.key === 'T') showSkillTree();
    if (e.key === ' ') { useSkill(G.selectedSkill, mouseWorld.x, mouseWorld.y); e.preventDefault(); }
    if (e.key === 'Escape') closeAllPanels();
  });
  document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  // Expose globals needed by dynamic onclick strings in HTML
  Object.assign(window, {
    selectClass, toggleInventory, usePotionBelt, showSkillTree, closeAllPanels,
    depositGold, withdrawGold, pushDeeper, returnToHub, loadHub,
    buyShopItem, buyUpgrade, spendSkillPoint, stashToBag, bagToStash,
    sellBagItem, unequipItem, buyPotion,
  });
}

// Named exports for React imports
export {
  selectClass, toggleInventory, usePotionBelt, showSkillTree, closeAllPanels,
  depositGold, withdrawGold, pushDeeper, returnToHub,
};
