/**
 * Configuration and links for Buy Me a Coffee donations and project support
 */

export const BUY_ME_A_COFFEE_USERNAME =
  process.env.NEXT_PUBLIC_BUYMEACOFFEE_USERNAME || 'emrojo';

export const BUY_ME_A_COFFEE_URL =
  process.env.NEXT_PUBLIC_BUYMEACOFFEE_URL ||
  `https://www.buymeacoffee.com/${BUY_ME_A_COFFEE_USERNAME}`;

export const DONATION_CONFIG = {
  title: '¿Te gusta Pachas?',
  subtitle: 'Apoya el mantenimiento y la creación de nuevas apps',
  description:
    'Pachas es una aplicación 100% gratuita, sin anuncios y de código abierto. Si te resulta útil para organizar los gastos en tus vacaciones con amigos y quieres ayudarme a cubrir los costes del servidor o apoyar el desarrollo de nuevas funciones, ¡cualquier donación es de gran ayuda!',
  coffeePrice: 3, // €
  presetOptions: [
    { count: 1, label: '1 Café', amount: '3 €', emoji: '☕' },
    { count: 3, label: '3 Cafés', amount: '9 €', emoji: '☕☕☕' },
    { count: 5, label: '5 Cafés', amount: '15 €', emoji: '🎉' },
  ],
};
