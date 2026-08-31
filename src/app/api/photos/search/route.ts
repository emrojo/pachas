import { NextRequest, NextResponse } from 'next/server';

export interface PhotoResult {
  id: string | number;
  url: string;
  thumb: string;
  alt: string;
  photographer: string;
  photographer_url?: string;
  source: 'pexels' | 'curated';
}

const FALLBACK_PHOTO_CATALOG: Array<{ keywords: string[]; photo: PhotoResult }> = [
  // Playa / Beach
  {
    keywords: ['playa', 'beach', 'cala', 'mar', 'costa', 'isla', 'mallorca', 'ibiza', 'menorca', 'formentera', 'canarias', 'cadiz', 'verano', 'sol', 'barco'],
    photo: {
      id: 'f-playa-1',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
      alt: 'Playa paradisíaca de arena blanca y aguas turquesas',
      photographer: 'Sean Oulashin',
      photographer_url: 'https://unsplash.com/@thevoncomplex',
      source: 'curated',
    },
  },
  {
    keywords: ['playa', 'beach', 'cala', 'isla', 'mediterraneo', 'verano', 'palmeras'],
    photo: {
      id: 'f-playa-2',
      url: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=500&auto=format&fit=crop&q=80',
      alt: 'Puesta de sol en la costa',
      photographer: 'Guille Pozzi',
      photographer_url: 'https://unsplash.com/@guillepozzi',
      source: 'curated',
    },
  },
  // Montaña / Mountain
  {
    keywords: ['montana', 'mountain', 'pirineos', 'sierra', 'senderismo', 'alpes', 'picos', 'naturaleza', 'valle', 'trekk', 'bosque'],
    photo: {
      id: 'f-montana-1',
      url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=80',
      alt: 'Picos montañosos con nubes al amanecer',
      photographer: 'Kalina Mumford',
      photographer_url: 'https://unsplash.com/@kalina_mumford',
      source: 'curated',
    },
  },
  {
    keywords: ['montana', 'mountain', 'lago', 'senderismo', 'escalada', 'verde', 'paisaje'],
    photo: {
      id: 'f-montana-2',
      url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500&auto=format&fit=crop&q=80',
      alt: 'Valle verde y niebla en las colinas',
      photographer: 'Bailey Zindel',
      photographer_url: 'https://unsplash.com/@baileyzindel',
      source: 'curated',
    },
  },
  // Cena / Gastronomía
  {
    keywords: ['cena', 'comida', 'tapas', 'restaurante', 'dinner', 'bar', 'pizz', 'vino', 'cerveza', 'comer', 'paella', 'asado', 'barbacoa', 'brunch'],
    photo: {
      id: 'f-cena-1',
      url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80',
      alt: 'Mesa con platos deliciosos, copas y ambiente cálido',
      photographer: 'Dan Gold',
      photographer_url: 'https://unsplash.com/@danielcgold',
      source: 'curated',
    },
  },
  {
    keywords: ['cena', 'tapas', 'bar', 'amigos', 'copas', 'brindis', 'vinos'],
    photo: {
      id: 'f-cena-2',
      url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&auto=format&fit=crop&q=80',
      alt: 'Restaurante animado con iluminación acogedora',
      photographer: 'Jason Leung',
      photographer_url: 'https://unsplash.com/@ninjason',
      source: 'curated',
    },
  },
  // Ciudad / City
  {
    keywords: ['ciudad', 'city', 'viaje', 'escapada', 'madrid', 'barcelona', 'roma', 'paris', 'londres', 'nueva york', 'berlin', 'amsterdam', 'lisboa', 'turismo', 'urban'],
    photo: {
      id: 'f-ciudad-1',
      url: 'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=500&auto=format&fit=crop&q=80',
      alt: 'Big Ben y calles de ciudad europea',
      photographer: 'Lucas Davies',
      photographer_url: 'https://unsplash.com/@lucasdavies',
      source: 'curated',
    },
  },
  {
    keywords: ['ciudad', 'city', 'arquitectura', 'calles', 'centro', 'europa', 'roma', 'italia'],
    photo: {
      id: 'f-ciudad-2',
      url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500&auto=format&fit=crop&q=80',
      alt: 'Coliseo de Roma al atardecer',
      photographer: 'Mauricio Artieda',
      photographer_url: 'https://unsplash.com/@mauricioartieda',
      source: 'curated',
    },
  },
  // Fiesta / Nightlife
  {
    keywords: ['fiesta', 'party', 'noche', 'copas', 'festival', 'concierto', 'discoteca', 'cumpleanos', 'despedida', 'musica', 'baile'],
    photo: {
      id: 'f-fiesta-1',
      url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=80',
      alt: 'Luces de neón y ambiente de fiesta nocturna',
      photographer: 'Moritz Knöringer',
      photographer_url: 'https://unsplash.com/@moritz_knoeringer',
      source: 'curated',
    },
  },
  // Camping & Roadtrip
  {
    keywords: ['camping', 'camp', 'tienda', 'furgoneta', 'van', 'caravana', 'roadtrip', 'ruta', 'coche', 'aventura', 'hoguera'],
    photo: {
      id: 'f-camping-1',
      url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=500&auto=format&fit=crop&q=80',
      alt: 'Tienda de campaña bajo las estrellas y bosque',
      photographer: 'Tommy Lisbin',
      photographer_url: 'https://unsplash.com/@tommylisbin',
      source: 'curated',
    },
  },
  // Nieve / Ski
  {
    keywords: ['nieve', 'snow', 'esqui', 'ski', 'snowboard', 'invierno', 'alpes', 'andorra', 'baqueira', 'sierra nevada', 'chalet'],
    photo: {
      id: 'f-nieve-1',
      url: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=500&auto=format&fit=crop&q=80',
      alt: 'Estación de esquí y montañas cubiertas de nieve blanca',
      photographer: 'Daniel Frank',
      photographer_url: 'https://unsplash.com/@frantic',
      source: 'curated',
    },
  },
  // Casa rural / Relax
  {
    keywords: ['casa', 'rural', 'pueblo', 'piscina', 'chalet', 'relax', 'villa', 'jardin'],
    photo: {
      id: 'f-rural-1',
      url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&auto=format&fit=crop&q=80',
      thumb: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=500&auto=format&fit=crop&q=80',
      alt: 'Piscina y terraza en villa de verano',
      photographer: 'Sara Dubler',
      photographer_url: 'https://unsplash.com/@saradubler',
      source: 'curated',
    },
  },
];

function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q') || 'viaje amigos';
    const perPage = Math.min(Number(searchParams.get('per_page')) || 9, 20);

    const apiKey = process.env.PEXELS_API_KEY || process.env.NEXT_PUBLIC_PEXELS_API_KEY;

    // If Pexels API Key is configured, attempt real Pexels API request
    if (apiKey) {
      try {
        const pexelsRes = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(rawQuery)}&per_page=${perPage}&orientation=landscape`,
          {
            headers: {
              Authorization: apiKey,
            },
            next: { revalidate: 3600 },
          }
        );

        if (pexelsRes.ok) {
          const data = await pexelsRes.json();
          if (Array.isArray(data.photos) && data.photos.length > 0) {
            const pexelsPhotos: PhotoResult[] = data.photos.map((p: any) => ({
              id: p.id,
              url: p.src?.large2x || p.src?.large || p.src?.landscape || p.src?.original,
              thumb: p.src?.medium || p.src?.small,
              alt: p.alt || rawQuery,
              photographer: p.photographer || 'Pexels Contributor',
              photographer_url: p.photographer_url || 'https://www.pexels.com',
              source: 'pexels',
            }));

            return NextResponse.json({
              query: rawQuery,
              photos: pexelsPhotos,
              source: 'pexels',
            });
          }
        }
      } catch (pexelsErr) {
        console.warn('Pexels API fetch failed, falling back to curated library:', pexelsErr);
      }
    }

    // Curated contextual fallback
    const norm = normalizeQuery(rawQuery);
    const tokens = norm.split(/\s+/).filter((t) => t.length > 2);

    const scored = FALLBACK_PHOTO_CATALOG.map((item) => {
      let score = 0;
      for (const token of tokens) {
        if (item.keywords.some((k) => k.includes(token) || token.includes(k))) {
          score += 2;
        }
      }
      return { photo: item.photo, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // If no strong match, return diverse catalog selection
    const results = scored.map((s) => s.photo);
    const sliced = results.slice(0, perPage);

    return NextResponse.json({
      query: rawQuery,
      photos: sliced,
      source: 'curated',
    });
  } catch (err: any) {
    console.error('Error in /api/photos/search:', err);
    return NextResponse.json(
      { error: err.message || 'Error al buscar fotos de portada' },
      { status: 500 }
    );
  }
}
