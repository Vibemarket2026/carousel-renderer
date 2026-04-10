# Vibemarket Render Engine v2.0

Motor de renderizado de carruseles y posts GMB para Vibemarket.  
Satori (JSX → SVG) + Resvg (SVG → PNG), desplegado en Vercel.

## Arquitectura

```
n8n workflow → HTTP POST → Vercel Function → Satori → Resvg → PNG base64
```

El motor combina 3 dimensiones de diseño:
- **6 Moods**: dark_minimal, light_clean, bold_primary, soft_pastel, color_block, warm_gradient
- **6 Layouts**: centered, left_aligned, big_stat, split_panel, quote_block, cta_final
- **5 Decorations**: none, accent_line, geometric_circles, corner_block, dot_pattern

Total: **180 combinaciones** visuales únicas. Todos los colores se derivan automáticamente de los 2 colores de marca del usuario con validación WCAG de contraste.

## Setup

### 1. Fork y deploy

```bash
git clone https://github.com/TU_USUARIO/vibemarket-render-engine.git
cd vibemarket-render-engine
npm install
```

### 2. Descargar fuentes

Descarga los archivos .ttf de Google Fonts y ponlos en `/fonts/`:

**Mínimo requerido:**
- Inter-Regular.ttf, Inter-Bold.ttf

**Recomendado (15 familias):**
- Inter, Roboto, Open Sans, Montserrat, Poppins, Lato, Raleway,
  Playfair Display, Merriweather, Nunito, Source Sans Pro, Work Sans,
  DM Sans, Outfit, Plus Jakarta Sans

Cada familia necesita -Regular.ttf y -Bold.ttf.

Script rápido para descargar desde Google Fonts:
```bash
# Ejemplo para Montserrat:
# Ve a fonts.google.com → Montserrat → Download family
# Extrae Montserrat-Regular.ttf y Montserrat-Bold.ttf a /fonts/
```

### 3. Deploy a Vercel

```bash
npx vercel --prod
```

O conecta el repo a Vercel para auto-deploy en cada push.

## API Reference

### POST /api/render-slide

Renderiza un slide individual y devuelve PNG en base64.

**Request body:**

```json
{
  "slide_number": 1,
  "total_slides": 7,
  "slide_type": "cover",
  "title": "5 errores que destruyen tu espalda cada día",
  "subtitle": "Ergonomía en el trabajo",
  "body_text": "Tu postura frente al ordenador determina si tendrás dolor crónico a los 40.",
  
  "brand": {
    "name": "Clínica Fisio López",
    "color_primary": "#2D5A3D",
    "color_secondary": "#E8A87C",
    "font_heading": "Montserrat",
    "font_body": "Inter",
    "logo_url": null
  },
  
  "mood": "dark_minimal",
  "layout": "centered",
  "decoration": "accent_line",
  
  "output": {
    "width": 1080,
    "height": 1350,
    "format": "png"
  }
}
```

**Campos opcionales por tipo de slide:**

| slide_type | Campos adicionales |
|---|---|
| `cover` | title, subtitle, body_text |
| `content` | title, subtitle, body_text, emoji |
| `big_stat` | stat_number ("85%"), stat_label ("de pacientes mejoran"), body_text (fuente) |
| `quote` | title (el texto de la cita), quote_attribution ("María G., paciente") |
| `cta` | title (CTA text), body_text (botón text), brand.logo_url |

**Auto-design:** Si no envías mood, layout o decoration, el motor los selecciona automáticamente según el slide_type con variedad determinista.

**Response:**

```json
{
  "success": true,
  "image_base64": "iVBORw0KGgo...",
  "dimensions": { "width": 1080, "height": 1350 },
  "render_time_ms": 623
}
```

**Posts GMB (horizontal):** Usa `output.width: 1200, output.height: 900`.

## Integración con n8n

### HTTP Request Node

En tu workflow de generación de calendario, después de que Gemini genere el contenido:

```
Método: POST
URL: https://tu-proyecto.vercel.app/api/render-slide
Content-Type: application/json

Body (Expression):
{
  "slide_number": {{ $json.slide_number }},
  "total_slides": {{ $json.total_slides }},
  "slide_type": "{{ $json.slide_type }}",
  "title": "{{ $json.title }}",
  "subtitle": "{{ $json.subtitle }}",
  "body_text": "{{ $json.body_text }}",
  "stat_number": "{{ $json.stat_number }}",
  "stat_label": "{{ $json.stat_label }}",
  "brand": {
    "name": "{{ $json.brand_name }}",
    "color_primary": "{{ $json.color_primary }}",
    "color_secondary": "{{ $json.color_secondary }}",
    "font_heading": "{{ $json.font_heading }}",
    "font_body": "{{ $json.font_body }}",
    "logo_url": {{ $json.logo_url ? '"' + $json.logo_url + '"' : 'null' }}
  },
  "mood": "{{ $json.mood }}",
  "layout": "{{ $json.layout }}",
  "decoration": "{{ $json.decoration }}"
}
```

### Flujo completo en n8n

```
1. Cron / Webhook trigger
2. Supabase: leer brand_identity (colores, fuentes, voz)
3. Gemini 2.5 Pro: generar contenido + design_intent para cada slide
4. SplitInBatches: iterar sobre slides
5. HTTP Request: POST a /api/render-slide → recibe image_base64
6. Code node: upload base64 a Supabase Storage
7. Supabase: actualizar content_calendar con image_url
```

### Prompt para Gemini (design_intent)

Añade esto al prompt de generación de calendario para que Gemini elija los design params:

```
Para cada slide, además del contenido, indica el diseño:
- mood: uno de [dark_minimal, light_clean, bold_primary, soft_pastel, color_block, warm_gradient]
- layout: uno de [centered, left_aligned, big_stat, split_panel, quote_block, cta_final]  
- decoration: uno de [none, accent_line, geometric_circles, corner_block, dot_pattern]

Reglas:
- La slide 1 (cover) siempre usa layout "centered"
- La última slide (CTA) siempre usa layout "cta_final"
- Mantén el mismo mood para todo el carrusel (coherencia visual)
- Varía layouts entre slides para evitar monotonía
- Usa "big_stat" cuando haya un dato numérico impactante
- Usa "quote_block" para testimonios
- Usa "split_panel" para slides con dato + explicación
```

## Moods

| Mood | Personalidad | Mejor para |
|---|---|---|
| dark_minimal | Elegante, nocturno, tipografía protagonista | Contenido serio, profesional |
| light_clean | Aireado, confianza médica, profesional | Salud, bienestar, educativo |
| bold_primary | Color de marca dominante, alto impacto | Branding fuerte, CTAs |
| soft_pastel | Cálido, accesible, suave | Público general, bienestar |
| color_block | Paneles editorial, moderno | GMB promos, ofertas, datos |
| warm_gradient | Gradiente envolvente, premium | Covers, CTAs, emocional |

## Estructura del proyecto

```
vibemarket-render-engine/
├── api/
│   └── render-slide.ts      # Vercel serverless endpoint
├── lib/
│   ├── types.ts              # TypeScript types + font registry
│   ├── contrast.ts           # WCAG contrast + palette derivation
│   ├── layouts.ts            # 6 layout modules (flexbox auto-layout)
│   ├── decorations.ts        # 5 decoration modules
│   ├── composer.ts           # Orchestrator: mood × layout × decoration
│   └── fonts.ts              # Font loader with cache
├── fonts/                    # .ttf files (not committed, download separately)
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```

## Costes Vercel

Plan Hobby (gratis): 100GB-horas/mes.  
50 calendarios/mes × 7 slides × ~1s = ~6 minutos → 0.01% del límite.

Plan Pro (20$/mes): 1000GB-horas → suficiente para miles de calendarios.
