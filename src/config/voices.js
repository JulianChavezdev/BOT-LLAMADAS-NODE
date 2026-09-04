export const spanishSpainVoices = [
    { id: 'aura-2-nestor-es', name: 'Nestor', description: 'Masculina, calmada y profesional' },
    { id: 'aura-2-carina-es', name: 'Carina', description: 'Femenina, energética y cercana' },
    { id: 'aura-2-alvaro-es', name: 'Alvaro', description: 'Masculina, clara y segura' },
    { id: 'aura-2-diana-es', name: 'Diana', description: 'Femenina, expresiva y profesional' },
    { id: 'aura-2-agustina-es', name: 'Agustina', description: 'Femenina, cálida y natural' }
];

export function isSupportedSpanishVoice(id) {
    return spanishSpainVoices.some(voice => voice.id === id);
}
