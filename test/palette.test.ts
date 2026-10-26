import { describe, expect, it } from 'vitest';
import { parseColor, withAlpha, COLORS } from '../src/ui/palette';

describe('Diagrammfarben', () => {
  it('zerlegt Hex und rgb', () => {
    expect(parseColor('#1d5fc4')).toEqual([29, 95, 196]);
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30]);
    expect(parseColor('rgb(10 20 30)')).toEqual([10, 20, 30]);
    expect(parseColor('banane')).toBeNull();
  });

  it('rechnet Farben in rgba mit Alpha um', () => {
    expect(withAlpha('#1d5fc4', 0.5)).toBe('rgba(29, 95, 196, 0.5)');
    expect(withAlpha('rgba(10, 20, 30, 0.9)', 0.1)).toBe('rgba(10, 20, 30, 0.1)');
    expect(withAlpha('banane', 0.5)).toBe('banane');
  });

  it('liefert ohne Dokument die hellen Rueckfallwerte', () => {
    expect(COLORS.blue).toBe('#1d5fc4');
    expect(COLORS.data).toBe('rgba(27, 30, 32, 0.55)');
  });
});
