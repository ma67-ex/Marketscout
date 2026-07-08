import type { GeoLocation, Place, PlaceReview, RedditPost } from "@/lib/types";

// Deterministic PRNG seeded from a string, so the same location + field always
// produces the same dataset and different inputs produce plausible variety.

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function createRng(seed: string) {
  let state = hashString(seed) || 1;
  return {
    next(): number {
      state ^= state << 13;
      state ^= state >> 17;
      state ^= state << 5;
      return (state >>> 0) / 0xffffffff;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    float(min: number, max: number): number {
      return min + this.next() * (max - min);
    },
    shuffle<T>(arr: T[]): T[] {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

// Haversine distance in meters between two lat/lng points.
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Business archetypes covering diverse categories.
interface Archetype {
  primaryCategory: string;
  categories: string[];
  names: string[];
  ratingRange: [number, number];
  priceLevel: number;
  reviewSnippets: string[];
}

const ARCHETYPES: readonly Archetype[] = [
  {
    primaryCategory: "Coffee shop",
    categories: ["cafe", "coffee", "food_and_drink"],
    names: ["Bean & Brew", "Morning Grounds", "Roast House", "Corner Cup"],
    ratingRange: [3.2, 4.8],
    priceLevel: 1,
    reviewSnippets: [
      "Great espresso but the wifi is painfully slow",
      "Love the atmosphere, wish they had more food options",
      "Overpriced for what you get, but convenient location",
      "Best latte in town, staff is always friendly",
      "Parking is a nightmare during morning rush",
      "They need to stay open later, closes way too early",
    ],
  },
  {
    primaryCategory: "Restaurant",
    categories: ["restaurant", "food", "dining"],
    names: ["The Local Table", "Main Street Grill", "Flavor House", "Town Kitchen"],
    ratingRange: [3.0, 4.6],
    priceLevel: 2,
    reviewSnippets: [
      "Good food but wait times are insane on weekends",
      "They really need vegan and vegetarian options",
      "Solid comfort food, nothing fancy but reliable",
      "Service has gone downhill, food is still decent",
      "Would love a delivery option, no one delivers here",
      "Portions are generous, prices are fair for the area",
    ],
  },
  {
    primaryCategory: "Fast food",
    categories: ["fast_food", "restaurant", "food"],
    names: ["Quick Bites", "Burger Barn", "Wrap & Roll", "Drive-Thru Diner"],
    ratingRange: [2.8, 4.0],
    priceLevel: 1,
    reviewSnippets: [
      "Cheap and fast but nothing special",
      "Wish they had healthier options on the menu",
      "Late-night hours are a lifesaver",
      "Quality has dropped, tastes like everything is frozen now",
      "Drive-thru line is always ridiculously long",
    ],
  },
  {
    primaryCategory: "Gym",
    categories: ["gym", "fitness", "health"],
    names: ["Iron Works Fitness", "FitZone", "Peak Performance Gym", "Strength & Co"],
    ratingRange: [3.5, 4.7],
    priceLevel: 2,
    reviewSnippets: [
      "Equipment is dated, they need to invest in upgrades",
      "Great trainers but membership is expensive",
      "Always crowded between 5-7pm, impossible to get a machine",
      "Clean facility, friendly staff, would recommend",
      "Wish they offered more group classes",
      "No 24-hour access is a dealbreaker for shift workers",
    ],
  },
  {
    primaryCategory: "Pharmacy",
    categories: ["pharmacy", "health", "medical"],
    names: ["HealthFirst Pharmacy", "Care Plus", "Town Drug", "MedPoint"],
    ratingRange: [3.0, 4.4],
    priceLevel: 1,
    reviewSnippets: [
      "Always a long wait for prescriptions",
      "Staff is knowledgeable and helpful",
      "Limited hours on weekends is frustrating",
      "They carry a good selection of over-the-counter products",
    ],
  },
  {
    primaryCategory: "Grocery store",
    categories: ["supermarket", "grocery", "food"],
    names: ["Fresh Market", "Town Grocers", "Daily Harvest", "Green Basket"],
    ratingRange: [3.3, 4.5],
    priceLevel: 2,
    reviewSnippets: [
      "Produce quality varies wildly week to week",
      "Prices are higher than the chain stores but selection is better",
      "Wish they had more organic and local options",
      "Checkout lines are always backed up",
      "The deli section is actually excellent",
    ],
  },
  {
    primaryCategory: "Hair salon",
    categories: ["hair_salon", "beauty", "personal_care"],
    names: ["Style Studio", "Clip & Co", "Shear Perfection", "The Cutting Room"],
    ratingRange: [3.5, 4.9],
    priceLevel: 2,
    reviewSnippets: [
      "Fantastic cuts but you need to book weeks in advance",
      "Prices jumped recently with no improvement in service",
      "The only decent salon in this part of town",
      "Walk-ins are never actually welcome despite the sign",
    ],
  },
  {
    primaryCategory: "Auto repair",
    categories: ["car_repair", "automotive", "service"],
    names: ["Reliable Auto", "Precision Motors", "Fix-It Garage", "Town Auto Care"],
    ratingRange: [3.0, 4.6],
    priceLevel: 2,
    reviewSnippets: [
      "Honest pricing, they do not upsell unnecessary work",
      "Took three days for a simple brake job",
      "Only mechanic I trust around here",
      "No loaner cars or shuttle service is inconvenient",
    ],
  },
  {
    primaryCategory: "Tutoring center",
    categories: ["education", "tutoring", "learning"],
    names: ["BrightMinds Tutoring", "A+ Learning Center", "Study Hub", "Academic Edge"],
    ratingRange: [3.8, 4.9],
    priceLevel: 2,
    reviewSnippets: [
      "My kid's grades improved significantly",
      "Expensive but worth it for SAT prep",
      "Wish they offered more STEM subjects",
      "Great for younger kids, not much for high schoolers",
      "Online options would be a huge plus",
    ],
  },
  {
    primaryCategory: "Coworking space",
    categories: ["coworking", "office", "business"],
    names: ["The Hive", "WorkLab", "Desk & Draft", "Launchpad Space"],
    ratingRange: [3.5, 4.7],
    priceLevel: 2,
    reviewSnippets: [
      "Fast wifi and good coffee, what more do you need",
      "Meeting rooms are always booked, need more capacity",
      "Great community events and networking opportunities",
      "Pricing is steep for just a hot desk",
    ],
  },
  {
    primaryCategory: "Bakery",
    categories: ["bakery", "food", "cafe"],
    names: ["Golden Crust", "Sweet Flour", "The Bread Basket", "Rise & Shine Bakery"],
    ratingRange: [3.8, 4.9],
    priceLevel: 1,
    reviewSnippets: [
      "Best pastries in the area, always fresh",
      "They sell out of everything by noon",
      "Wish they had gluten-free options",
      "Custom cakes are their real strength",
    ],
  },
  {
    primaryCategory: "Yoga studio",
    categories: ["yoga", "fitness", "wellness"],
    names: ["Flow Studio", "Breathe Yoga", "Inner Balance", "Zen Space"],
    ratingRange: [4.0, 4.9],
    priceLevel: 2,
    reviewSnippets: [
      "Wonderful instructors, very welcoming to beginners",
      "Class schedule is limited, hard to find evening slots",
      "The space itself is beautiful and calming",
      "Drop-in rates are too high compared to memberships",
    ],
  },
  {
    primaryCategory: "Pet store",
    categories: ["pet_store", "retail", "animals"],
    names: ["Paws & Claws", "Happy Tails", "The Pet Corner", "Fur & Feather"],
    ratingRange: [3.5, 4.6],
    priceLevel: 2,
    reviewSnippets: [
      "Great selection but prices are above average",
      "Staff actually knows about animal care",
      "Grooming services are excellent",
      "Wish they carried more specialty pet food brands",
    ],
  },
  {
    primaryCategory: "Dentist",
    categories: ["dentist", "health", "medical"],
    names: ["Bright Smile Dental", "Town Dental Care", "Gentle Dentistry", "Family Dental"],
    ratingRange: [3.2, 4.8],
    priceLevel: 3,
    reviewSnippets: [
      "Very gentle, even my anxious kid was comfortable",
      "Impossible to get an appointment within two weeks",
      "Office is outdated but the work is quality",
      "They accept most insurance which is a plus",
    ],
  },
  {
    primaryCategory: "Laundromat",
    categories: ["laundry", "service", "cleaning"],
    names: ["Clean Spin", "Fresh & Fold", "QuickWash", "Suds Laundromat"],
    ratingRange: [2.5, 4.0],
    priceLevel: 1,
    reviewSnippets: [
      "Half the machines are always broken",
      "Clean enough and reasonably priced",
      "Needs better lighting and security cameras",
      "A wash and fold service would be amazing here",
    ],
  },
  {
    primaryCategory: "Bookstore",
    categories: ["bookstore", "retail", "education"],
    names: ["Page Turner Books", "The Reading Room", "Ink & Paper", "Town Books"],
    ratingRange: [4.0, 4.9],
    priceLevel: 2,
    reviewSnippets: [
      "The curated selection is what keeps me coming back",
      "They host great author events and book clubs",
      "Wish they had a bigger kids section",
      "Prices can not compete with online but the experience is worth it",
    ],
  },
  {
    primaryCategory: "Dry cleaner",
    categories: ["dry_cleaning", "laundry", "service"],
    names: ["Express Cleaners", "Pristine Dry Clean", "Town Cleaners", "SpotFree"],
    ratingRange: [3.0, 4.5],
    priceLevel: 2,
    reviewSnippets: [
      "Fast turnaround and quality work",
      "Lost a shirt once, handling of the complaint was poor",
      "Only option in the area so they have no competition",
      "Pickup and delivery service would be a game changer",
    ],
  },
  {
    primaryCategory: "Pizza place",
    categories: ["pizza", "restaurant", "food"],
    names: ["Slice House", "Town Pizza", "Fire & Dough", "Crust & Co"],
    ratingRange: [3.5, 4.7],
    priceLevel: 1,
    reviewSnippets: [
      "Solid New York style, best pizza nearby",
      "Delivery takes forever during peak hours",
      "Wish they had more specialty and gourmet options",
      "Good value for a quick family dinner",
    ],
  },
  {
    primaryCategory: "Daycare center",
    categories: ["childcare", "education", "family"],
    names: ["Little Stars Daycare", "Sunshine Kids", "Happy Hearts", "Tiny Steps"],
    ratingRange: [3.5, 4.8],
    priceLevel: 3,
    reviewSnippets: [
      "My child loves going, the staff is wonderful",
      "Waitlist is months long, not enough capacity in this area",
      "Communication with parents could be much better",
      "Safe and clean environment, reasonable rates",
    ],
  },
  {
    primaryCategory: "Insurance agency",
    categories: ["insurance", "finance", "service"],
    names: ["Shield Insurance", "SafeGuard Agency", "Town Coverage", "TrustPoint Insurance"],
    ratingRange: [3.0, 4.4],
    priceLevel: 0,
    reviewSnippets: [
      "Responsive when you actually need to file a claim",
      "Agent was helpful in finding the right coverage",
      "Rates increased significantly at renewal without explanation",
      "Wish they offered more online self-service options",
    ],
  },
  {
    primaryCategory: "Nail salon",
    categories: ["nail_salon", "beauty", "personal_care"],
    names: ["Polish & Shine", "Luxe Nails", "The Nail Bar", "Color Studio"],
    ratingRange: [3.3, 4.7],
    priceLevel: 1,
    reviewSnippets: [
      "Great gel manicures at reasonable prices",
      "Sanitation practices could be better",
      "Always busy on weekends, long waits without appointment",
      "Friendly staff and nice atmosphere",
    ],
  },
  {
    primaryCategory: "Juice bar",
    categories: ["juice_bar", "health", "food_and_drink"],
    names: ["Fresh Press", "Green Machine", "Vitality Juice", "Blend Bar"],
    ratingRange: [3.8, 4.8],
    priceLevel: 2,
    reviewSnippets: [
      "Smoothies are great but overpriced for the portion",
      "Love the health-focused menu",
      "More protein bowl options would be great",
      "The acai bowls are the real draw here",
    ],
  },
  {
    primaryCategory: "Printing shop",
    categories: ["print_shop", "service", "business"],
    names: ["QuickPrint", "Copy Corner", "InkWorks", "Town Print & Ship"],
    ratingRange: [3.0, 4.3],
    priceLevel: 1,
    reviewSnippets: [
      "Reliable for basic printing but design help is minimal",
      "Turnaround time is slow for large orders",
      "Convenient location and friendly owner",
      "Prices are fair compared to the chain stores",
    ],
  },
  {
    primaryCategory: "Veterinarian",
    categories: ["veterinarian", "health", "animals"],
    names: ["Town Vet Clinic", "Companion Animal Care", "Healthy Paws Vet", "All Creatures"],
    ratingRange: [3.5, 4.8],
    priceLevel: 3,
    reviewSnippets: [
      "Truly compassionate care for our pets",
      "Emergency hours would be a huge improvement",
      "Expensive but they are thorough",
      "Wait times can be very long even with an appointment",
    ],
  },
];

// Reddit post templates written in local-subreddit voice.
const REDDIT_TEMPLATES: readonly {
  title: string;
  body: string;
  themes: string[];
}[] = [
  {
    title: "What does {city} actually need?",
    body: "Been living here for years and it feels like we are missing some basics. There is nowhere decent to get {field}-related services. Anyone else feel the same?",
    themes: ["gap", "services"],
  },
  {
    title: "Why is there no good late-night food in {city}?",
    body: "Everything closes by 9pm. If you work second shift or are studying late, your only option is the gas station. We desperately need something open past midnight.",
    themes: ["late-night", "food"],
  },
  {
    title: "Parking situation in downtown {city} is terrible",
    body: "Tried to grab lunch downtown yesterday, spent 15 minutes circling for a spot. The meter situation is a mess. Businesses are losing customers because nobody wants to deal with it.",
    themes: ["parking", "downtown"],
  },
  {
    title: "Any {field} professionals in {city}?",
    body: "Looking for someone local who does {field} work. Tired of driving 30+ minutes to the next town for something that should be available here.",
    themes: ["professional services", "gap"],
  },
  {
    title: "New to {city}, what should I know?",
    body: "Just moved here for work. The area seems nice but quiet. Where do people hang out? Is there any nightlife or community events? Feeling like there is not much to do.",
    themes: ["community", "entertainment"],
  },
  {
    title: "The gym options here are disappointing",
    body: "There are two gyms in the area and both are overcrowded with outdated equipment. Would love a modern fitness center with actual classes and extended hours.",
    themes: ["fitness", "gap"],
  },
  {
    title: "{city} needs more healthy food options",
    body: "Every restaurant is burgers and pizza. Nothing wrong with that but some of us want salads, grain bowls, smoothies. The nearest health-focused place is a 20 minute drive.",
    themes: ["healthy food", "gap", "food"],
  },
  {
    title: "Anyone else frustrated with delivery options in {city}?",
    body: "Half the restaurants do not deliver and the ones that do take over an hour. Would love to see more places sign up for delivery or a local service that actually works.",
    themes: ["delivery", "food"],
  },
  {
    title: "Coworking or quiet study spots in {city}?",
    body: "Working remote and the coffee shops are loud. Is there a coworking space or library with good wifi? Would happily pay for a decent workspace.",
    themes: ["coworking", "wifi", "workspace"],
  },
  {
    title: "Childcare crisis in {city}",
    body: "Every daycare has a months-long waitlist. Both parents work and we are stuck. This area desperately needs more childcare options that are not highway-robbery expensive.",
    themes: ["childcare", "family"],
  },
  {
    title: "Support local businesses in {city}!",
    body: "The small businesses here are struggling. Let us talk about what is good: the bakery on Main is excellent, the auto shop is honest. What else should people know about?",
    themes: ["local business", "community"],
  },
  {
    title: "Tech services in {city} are nonexistent",
    body: "Need computer repair, phone screen replacement, or basic IT help? Good luck. Nobody offers it locally. This seems like an obvious business opportunity for someone with {field} skills.",
    themes: ["tech", "gap", "services"],
  },
  {
    title: "Rent keeps going up in {city} but amenities stay the same",
    body: "Paying more every year but we still have the same three restaurants and one grocery store. New housing developments keep popping up but no new services to match the growing population.",
    themes: ["growth", "gap", "services"],
  },
  {
    title: "Best and worst things about living in {city}",
    body: "Best: safe neighborhood, good schools, reasonable cost of living. Worst: nothing to do at night, limited dining, have to drive to the next city for most shopping and entertainment.",
    themes: ["quality of life", "entertainment", "dining"],
  },
];

export function mockGeocodeFor(query: string): GeoLocation {
  const rng = createRng("geo:" + query.toLowerCase());
  const parts = query.split(",").map((s) => s.trim());
  const city = parts[0] || query;
  const region = parts[1] || undefined;
  // Deterministic but plausible coordinates in North America.
  const lat = rng.float(30, 48);
  const lng = rng.float(-120, -74);

  return {
    formattedAddress: region ? `${city}, ${region}` : city,
    lat,
    lng,
    city,
    region,
    country: "US",
  };
}

export function mockPlacesFor(
  location: GeoLocation,
  field: string,
  limit: number,
): Place[] {
  const rng = createRng(
    `places:${location.lat.toFixed(2)}:${location.lng.toFixed(2)}:${field}`,
  );
  const count = Math.min(limit, ARCHETYPES.length);
  const selected = rng.shuffle([...ARCHETYPES]).slice(0, count);
  const places: Place[] = [];

  for (let i = 0; i < selected.length; i++) {
    const arch = selected[i];
    const name = rng.pick(arch.names);
    const rating = Number(rng.float(arch.ratingRange[0], arch.ratingRange[1]).toFixed(1));
    const userRatingsTotal = rng.int(8, 320);
    const placeLat = location.lat + rng.float(-0.015, 0.015);
    const placeLng = location.lng + rng.float(-0.015, 0.015);

    const reviewCount = rng.int(2, Math.min(5, arch.reviewSnippets.length));
    const reviews: PlaceReview[] = rng
      .shuffle([...arch.reviewSnippets])
      .slice(0, reviewCount)
      .map((text) => ({
        rating: rng.int(1, 5),
        text,
      }));

    places.push({
      id: `mock-${i}-${hashString(name)}`,
      name,
      primaryCategory: arch.primaryCategory,
      categories: arch.categories,
      rating,
      userRatingsTotal,
      priceLevel: arch.priceLevel,
      location: { lat: placeLat, lng: placeLng },
      distanceMeters: Math.round(
        haversine(location.lat, location.lng, placeLat, placeLng),
      ),
      reviews,
    });
  }

  return places;
}

export function mockRedditFor(
  location: GeoLocation,
  keywords: string[],
  limit: number,
): RedditPost[] {
  const city = location.city || "this area";
  const field = keywords.find((k) => k !== city && k.length > 3) || "business";
  const rng = createRng(`reddit:${city}:${field}`);
  const count = Math.min(limit, REDDIT_TEMPLATES.length);
  const selected = rng.shuffle([...REDDIT_TEMPLATES]).slice(0, count);

  return selected.map((tmpl, i) => {
    const title = tmpl.title
      .replace("{city}", city)
      .replace("{field}", field);
    const body = tmpl.body
      .replace("{city}", city)
      .replace(/{field}/g, field);

    return {
      id: `mock-reddit-${i}`,
      subreddit: `r/${city.replace(/\s+/g, "")}`,
      title,
      text: body,
      score: rng.int(5, 450),
      numComments: rng.int(3, 85),
      url: `https://reddit.com/r/${city.replace(/\s+/g, "")}/mock/${i}`,
      createdUtc: Math.floor(Date.now() / 1000) - rng.int(86400, 86400 * 180),
      relevance: rng.float(0.6, 1.0),
    };
  });
}
