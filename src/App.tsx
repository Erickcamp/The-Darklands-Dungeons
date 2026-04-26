import { useEffect } from 'react';
import './index.css';
import {
  initEngine,
  selectClass,
  toggleInventory,
  usePotionBelt,
  showSkillTree,
  closeAllPanels,
  depositGold,
  withdrawGold,
  pushDeeper,
  returnToHub,
} from './game/engine';

export default function App() {
  useEffect(() => {
    initEngine();
  }, []);

  return (
    <div id="game">
      <canvas id="gameCanvas"></canvas>
      <div id="ui">
        <canvas id="minimap" width={120} height={90}></canvas>
        <div id="controls-hint">
          Left-click: Move/Attack &nbsp;|&nbsp; WASD: Move &nbsp;|&nbsp; Right-click: Skill<br />
          1/2/3/4: Select skill &nbsp;|&nbsp; Space: Cast selected skill<br />
          Q: HP Potion &nbsp;|&nbsp; E: MP Potion &nbsp;|&nbsp; F: Interact &nbsp;|&nbsp; T: Skill Tree &nbsp;|&nbsp; I: Inventory
        </div>
        <div id="area-msg"></div>
        <div id="hud">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span id="hp-text" style={{ fontSize: 11, color: '#ff8888', whiteSpace: 'nowrap' }}>100/100</span>
              <div id="orb-hp"><div id="orb-hp-fill" className="orb-fill" style={{ height: '100%' }}></div><div className="orb-shine"></div></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span id="mp-text" style={{ fontSize: 11, color: '#8888ff', whiteSpace: 'nowrap' }}>80/80</span>
              <div id="orb-mp"><div id="orb-mp-fill" className="orb-fill" style={{ height: '100%' }}></div><div className="orb-shine"></div></div>
            </div>
          </div>
          <div id="potion-belt">
            <div className="potion-slot" id="pbelt-0" onClick={() => usePotionBelt(0)} title="Healing Potion">
              <span id="pbelt-icon-0">🧪</span><span className="pk">Q</span><span className="pc" id="pbelt-count-0"></span>
            </div>
            <div className="potion-slot" id="pbelt-1" onClick={() => usePotionBelt(1)} title="Mana Potion">
              <span id="pbelt-icon-1">💧</span><span className="pk">E</span><span className="pc" id="pbelt-count-1"></span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div id="skills-bar"></div>
            <div id="skill-pts-badge" onClick={showSkillTree} title="Open Skill Tree [T]">0 pts</div>
          </div>
          <div id="char-info">
            <div id="char-name">HERO</div>
            <div id="char-level">Level 1</div>
            <div id="xp-bar-wrap"><div id="xp-bar" style={{ width: '0%' }}></div></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div id="area-name">The Blood Moor</div>
            <div id="kill-count">Kills: 0</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div id="gold-display">⬡ 0 Gold</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>[I] Inventory</div>
          </div>
        </div>

        <button id="inv-btn" onClick={toggleInventory}>⚔ Inventory [I]</button>

        <div id="inv-panel">
          <div className="panel-title">⚔ Equipment &amp; Loot ⚔</div>
          <div id="equipped">
            <div className="equip-slot"><span className="slot-name">Weapon</span><span id="eq-weapon" className="slot-item">None</span></div>
            <div className="equip-slot"><span className="slot-name">Armor</span><span id="eq-armor" className="slot-item">None</span></div>
            <div className="equip-slot"><span className="slot-name">Helm</span><span id="eq-helm" className="slot-item">None</span></div>
            <div className="equip-slot"><span className="slot-name">Shoulders</span><span id="eq-shoulders" className="slot-item">None</span></div>
            <div className="equip-slot"><span className="slot-name">Gloves</span><span id="eq-gloves" className="slot-item">None</span></div>
            <div className="equip-slot"><span className="slot-name">Cape</span><span id="eq-cape" className="slot-item">None</span></div>
            <div className="equip-slot"><span className="slot-name">Legs</span><span id="eq-legs" className="slot-item">None</span></div>
            <div className="equip-slot"><span className="slot-name">Boots</span><span id="eq-boots" className="slot-item">None</span></div>
            <div className="equip-slot"><span className="slot-name">Neck</span><span id="eq-neck" className="slot-item">None</span></div>
            <div className="equip-slot"><span className="slot-name">Ring 1</span><span id="eq-ring1" className="slot-item">None</span></div>
            <div className="equip-slot"><span className="slot-name">Ring 2</span><span id="eq-ring2" className="slot-item">None</span></div>
          </div>
          <div className="panel-title" style={{ fontSize: 12 }}>Bag</div>
          <div id="bag"></div>
          <div id="stats-section">
            <div className="stat-row"><span className="stat-label">Damage</span><span className="stat-val" id="stat-dmg">0</span></div>
            <div className="stat-row"><span className="stat-label">Defense</span><span className="stat-val" id="stat-def">0</span></div>
            <div className="stat-row"><span className="stat-label">Move Speed</span><span className="stat-val" id="stat-spd">100%</span></div>
            <div className="stat-row"><span className="stat-label">Crit Chance</span><span className="stat-val" id="stat-crit">5%</span></div>
            <div className="stat-row"><span className="stat-label">Crit Damage</span><span className="stat-val" id="stat-critdmg">150%</span></div>
            <div className="stat-row"><span className="stat-label">Atk Speed</span><span className="stat-val" id="stat-atkspd">0%</span></div>
            <div className="stat-row"><span className="stat-label">CD Reduction</span><span className="stat-val" id="stat-cdr">0%</span></div>
          </div>
        </div>

        <div id="skill-tree-panel">
          <div className="panel-title">⚡ Skill Tree ⚡</div>
          <div id="sk-pts-label" style={{ textAlign: 'center', color: '#ffd700', fontSize: 12, marginBottom: 8 }}></div>
          <div id="sk-tree-list"></div>
          <div style={{ textAlign: 'center', marginTop: 10 }}><button className="big-btn" onClick={closeAllPanels}>Close</button></div>
        </div>

        <div id="msglog"></div>
        <div id="tooltip"></div>
        <div id="hub-prompt"></div>
        <div id="depth-indicator"></div>

        <div id="shop-panel">
          <div className="panel-title">⚒ Wandering Merchant ⚒</div>
          <div id="shop-gold" style={{ textAlign: 'center', color: '#ffd700', marginBottom: 8, fontSize: 12 }}></div>
          <div id="shop-items"></div>
          <div style={{ textAlign: 'center', marginTop: 10 }}><button className="big-btn" onClick={closeAllPanels}>Close</button></div>
        </div>

        <div id="stash-panel">
          <div className="panel-title">📦 Shared Stash 📦</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a0f05', border: '1px solid #3a2a0e', borderRadius: 3, padding: '6px 10px', marginBottom: 10 }}>
            <span style={{ color: '#ffd700', fontSize: 12 }}>⬡ Stash Gold: <span id="stash-gold-amount">0</span></span>
            <span style={{ color: '#ffd700', fontSize: 12 }}>⬡ Carried: <span id="stash-carried-amount">0</span></span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input id="stash-gold-input" type="number" min={1} placeholder="Amount" style={{ flex: 1, background: '#1a0f05', border: '1px solid #5c3d1e', borderRadius: 3, padding: '4px 8px', color: '#c8a96e', fontSize: 12, fontFamily: 'Georgia,serif', width: 0 }} />
            <button className="upg-btn" onClick={depositGold}>Deposit</button>
            <button className="upg-btn" onClick={withdrawGold}>Withdraw</button>
          </div>
          <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 6 }}>Click item to move between stash ↔ bag</div>
          <div className="panel-title" style={{ fontSize: 11 }}>Stash (40 slots)</div>
          <div id="stash-grid" className="stash-grid"></div>
          <div className="panel-title" style={{ fontSize: 11, marginTop: 10 }}>Your Bag</div>
          <div id="stash-bag" className="stash-grid"></div>
          <div style={{ textAlign: 'center', marginTop: 10 }}><button className="big-btn" onClick={closeAllPanels}>Close</button></div>
        </div>

        <div id="shrine-panel">
          <div className="panel-title">⚡ Shrine of Power ⚡</div>
          <div id="shrine-gold" style={{ textAlign: 'center', color: '#ffd700', marginBottom: 8, fontSize: 12 }}></div>
          <div id="shrine-upgrades"></div>
          <div style={{ textAlign: 'center', marginTop: 10 }}><button className="big-btn" onClick={closeAllPanels}>Close</button></div>
        </div>

        <div id="blessing-screen">
          <h1 style={{ fontSize: 26, color: '#ffd700', letterSpacing: 2 }}>⚜ Choose a Blessing ⚜</h1>
          <p style={{ fontSize: 13, color: '#888' }}>Your fate for this run. Choose wisely.</p>
          <div className="blessing-cards" id="blessing-cards"></div>
        </div>

        <div id="depth-choice">
          <div style={{ fontSize: 18, color: '#ffd700', marginBottom: 6 }}>⬇ Descend Further?</div>
          <div id="depth-choice-info" style={{ fontSize: 12, color: '#888', marginBottom: 16 }}></div>
          <button className="depth-btn" style={{ color: '#ff6040', borderColor: '#802010' }} onClick={pushDeeper}>⚔ Push Deeper — Better loot, stronger enemies</button>
          <button className="depth-btn" onClick={returnToHub}>🏠 Return to the Hearth — Keep your loot</button>
        </div>

        <div id="overlay">
          <h1>⚔ THE DARKLANDS DUNGEONS ⚔</h1>
          <p>Choose your warrior and descend into the cursed dungeons.<br />Survive. Grow stronger. Claim glory.</p>
          <div className="class-cards">
            <div className="class-card" onClick={() => selectClass('warrior')}>
              <div className="class-icon">⚔</div>
              <div className="class-name">Warrior</div>
              <div className="class-desc">Heavy melee fighter. Whirlwind &amp; War Cry.</div>
            </div>
            <div className="class-card" onClick={() => selectClass('fighter')}>
              <div className="class-icon">🗡</div>
              <div className="class-name">Fighter</div>
              <div className="class-desc">Agile striker. Shadow Step &amp; Blade Fury.</div>
            </div>
            <div className="class-card" onClick={() => selectClass('knight')}>
              <div className="class-icon">🛡</div>
              <div className="class-name">Knight</div>
              <div className="class-desc">Holy warrior. Blessed Hammer &amp; Divine Smite.</div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#555', marginTop: 8 }}>Left-click to move · WASD to move · Right-click skill · 1/2/3/4 switch skills · Q HP pot · E MP pot · F interact · I inventory</p>
        </div>
      </div>
    </div>
  );
}
