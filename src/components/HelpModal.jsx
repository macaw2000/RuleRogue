import React from 'react'

const HelpModal = ({ onClose }) => {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <h2>🗡️ Multiplayer Roguelike - Help</h2>
        
        <h3>Movement & Controls</h3>
        <p><strong>WASD</strong> or <strong>Arrow Keys</strong> - Move your character</p>
        <p><strong>H</strong> - Show this help screen</p>
        <p><strong>I</strong> - Toggle inventory display</p>
        <p><strong>ESC</strong> - Close help or inventory</p>
        
        <h3>Combat</h3>
        <p><strong>Walk into monsters</strong> - Attack them in melee combat</p>
        <p>You stay in your position during combat (NetHack rules)</p>
        <p>Only move into monster's space after killing it</p>
        
        <h3>Items & Loot</h3>
        <p><strong>Walk over items</strong> - Automatically pick them up</p>
        <p>Monsters drop weapons, armor, potions, and gold when killed</p>
        <p>Items are color-coded by rarity: <span style={{color: '#0f0'}}>Common</span>, <span style={{color: '#66f'}}>Uncommon</span>, <span style={{color: '#f6f'}}>Rare</span></p>
        
        <h3>Dungeon Navigation</h3>
        <p><strong>&lt;</strong> - Stairs up (stand on them and move to use)</p>
        <p><strong>&gt;</strong> - Stairs down (stand on them and move to use)</p>
        <p><strong>#</strong> - Walls (impassable)</p>
        <p><strong>.</strong> - Floor (walkable)</p>
        
        <h3>Character Classes</h3>
        <p><span className="class-fighter">Fighter (@)</span> - High health, strong melee combat</p>
        <p><span className="class-wizard">Wizard (*)</span> - Low health, magical abilities</p>
        <p><span className="class-rogue">Rogue (&)</span> - Balanced stats, stealth abilities</p>
        <p><span className="class-cleric">Cleric (+)</span> - Healing abilities, holy powers</p>
        
        <h3>Multiplayer</h3>
        <p>Share your room code with friends to play together</p>
        <p>All players see each other's actions in real-time</p>
        <p>Combat and loot are individual - no friendly fire</p>
        
        <button className="btn" onClick={onClose}>
          Close Help (ESC)
        </button>
      </div>
    </div>
  )
}

export default HelpModal