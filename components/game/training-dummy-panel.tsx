type TrainingDummyPanelProps = {
  cityName: string;
  onClose: () => void;
};

export function TrainingDummyPanel({ cityName, onClose }: TrainingDummyPanelProps) {
  return (
    <div
      style={{
        width: '560px',
        maxWidth: '90vw',
        color: '#edf4ff',
        background: 'linear-gradient(180deg, rgba(10, 17, 27, 0.96), rgba(16, 25, 36, 0.96))',
        border: '1px solid rgba(143, 180, 255, 0.38)',
        borderRadius: '20px',
        boxShadow: '0 18px 40px rgba(7, 12, 20, 0.7)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px 12px',
          background: 'linear-gradient(90deg, rgba(77, 122, 255, 0.18), rgba(40, 72, 117, 0.06))',
          borderBottom: '1px solid rgba(147, 177, 255, 0.2)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#9cc7ff',
              fontWeight: 700,
            }}
          >
            CITY TRAINING
          </div>
          <h2 style={{ margin: '6px 0 0', fontSize: '24px', fontWeight: 700 }}>{cityName}</h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: '#edf4ff',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            width: '36px',
            height: '36px',
            cursor: 'pointer',
            fontSize: '18px',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '18px 20px 10px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '12px',
            marginBottom: '18px',
          }}
        >
          {[
            ['Damage', '12.4K', '#ff9a73'],
            ['Crit', '23%', '#ffd166'],
            ['Hit', '99%', '#7ee0a0'],
            ['DPS', '1.9K', '#7cc6ff'],
          ].map(([label, value, color]) => (
            <div
              key={label}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '12px 10px',
              }}
            >
              <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9bb5d7' }}>{label}</div>
              <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 1.2fr',
            gap: '16px',
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '16px',
            }}
          >
            <div style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9bb5d7' }}>MODE</div>
            <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
              {['Single Target', 'AOE Burst', 'Combo Test', 'Armor Check'].map((mode, index) => (
                <button
                  key={mode}
                  style={{
                    textAlign: 'left',
                    padding: '12px 12px',
                    borderRadius: '10px',
                    border: index === 0 ? '1px solid rgba(130, 180, 255, 0.8)' : '1px solid rgba(255,255,255,0.08)',
                    background: index === 0 ? 'rgba(124, 198, 255, 0.12)' : 'rgba(255,255,255,0.02)',
                    color: '#edf4ff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9bb5d7' }}>TARGET</div>
              <span style={{ color: '#7ee0a0', fontWeight: 700 }}>Immortal</span>
            </div>

            <div
              style={{
                height: '210px',
                marginTop: '14px',
                borderRadius: '18px',
                background: 'radial-gradient(circle at center, rgba(137, 175, 255, 0.14), rgba(17, 24, 35, 0.8) 58%, rgba(9, 12, 18, 0.96))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '128px',
                  height: '128px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 50% 30%, #f5f9ff 0%, #dfeafc 22%, #9ab9d9 46%, #4b6788 100%)',
                  border: '4px solid rgba(255,255,255,0.45)',
                  boxShadow: '0 0 30px rgba(120, 170, 255, 0.46)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '14px',
                    borderRadius: '50%',
                    border: '3px solid rgba(18, 33, 53, 0.6)',
                  }}
                />
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: '18px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: '#dfeaff',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                }}
              >
                TRAINING DUMMY
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '18px',
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#edf4ff',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              padding: '10px 16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset Log
          </button>
          <button
            style={{
              background: 'linear-gradient(90deg, #4f8cff, #7a70ff)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Start Test
          </button>
        </div>
      </div>
    </div>
  );
}
