import { eq, and, desc, ilike } from 'drizzle-orm';
import { db } from '../../database/db.js';
import {
  farms,
  fields,
  cropSeasons,
  crops,
  soilReports,
  notifications,
  buyerListings,
  buyerProfiles,
  purchaseRequests,
  marketPriceObservations,
  extensionBulletins,
  weatherObservations,
  cropAdvisories,
} from '../../database/schema/index.js';
import { assertFarmerContext } from '../../common/auth/ownership.js';
import { voiceDispatcher, VoiceSessionContext, VoiceTool } from './dispatcher.js';

/**
 * Registers platform-wide Voice AI tools (Farmer info, Market/Weather/Soil/Advisory data,
 * Buyer connection workflow, and Call control) with strict caller identity & ownership enforcement.
 */
export function registerPlatformVoiceTools(): void {
  const tools: VoiceTool[] = [
    {
      name: 'get_farmer_profile',
      description: 'Retrieves the authenticated farmer profile and farm summary (no sensitive secrets).',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async (session: VoiceSessionContext) => {
        const profile = await assertFarmerContext(session.userId);
        const farmerFarms = await db
          .select({ id: farms.id, farmName: farms.farmName, totalAreaAcres: farms.totalAreaAcres })
          .from(farms)
          .where(eq(farms.farmerId, profile.id));
        return {
          fullName: profile.fullName,
          preferredLanguage: profile.preferredLanguage,
          location: `${profile.village}, ${profile.mandal}, ${profile.district}, ${profile.state}`,
          farms: farmerFarms,
          source: 'agrivoice_postgres',
        };
      },
    },
    {
      name: 'get_crop_history',
      description: 'Retrieves past and active crop seasons for the authenticated farmer.',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async (session: VoiceSessionContext) => {
        const profile = await assertFarmerContext(session.userId);
        const rows = await db
          .select({
            season: cropSeasons.season,
            sowingDate: cropSeasons.sowingDate,
            expectedHarvestDate: cropSeasons.expectedHarvestDate,
            status: cropSeasons.status,
            cropName: crops.name,
          })
          .from(cropSeasons)
          .innerJoin(fields, eq(cropSeasons.fieldId, fields.id))
          .innerJoin(farms, eq(fields.farmId, farms.id))
          .leftJoin(crops, eq(cropSeasons.cropId, crops.id))
          .where(eq(farms.farmerId, profile.id))
          .orderBy(desc(cropSeasons.sowingDate))
          .limit(5);
        return { seasons: rows, source: 'agrivoice_postgres' };
      },
    },
    {
      name: 'get_soil_health_history',
      description: 'Retrieves soil health report history stored in AgriVoice for the authenticated farmer.',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async (session: VoiceSessionContext) => {
        const profile = await assertFarmerContext(session.userId);
        const rows = await db
          .select({
            reportId: soilReports.reportId,
            cardId: soilReports.cardId,
            reportDate: soilReports.reportDate,
            soilType: soilReports.soilType,
            ph: soilReports.ph,
            nitrogen: soilReports.nitrogen,
            phosphorus: soilReports.phosphorus,
            potassium: soilReports.potassium,
            zinc: soilReports.zinc,
            source: soilReports.source,
            status: soilReports.status,
          })
          .from(soilReports)
          .where(eq(soilReports.farmerId, profile.id))
          .orderBy(desc(soilReports.reportDate))
          .limit(5);
        return { reports: rows, source: 'agrivoice_postgres' };
      },
    },
    {
      name: 'get_notifications',
      description: 'Retrieves recent unread or latest notifications for the authenticated caller.',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async (session: VoiceSessionContext) => {
        const rows = await db
          .select({
            title: notifications.title,
            message: notifications.message,
            category: notifications.category,
            isRead: notifications.isRead,
            createdAt: notifications.createdAt,
          })
          .from(notifications)
          .where(eq(notifications.userId, session.userId))
          .orderBy(desc(notifications.createdAt))
          .limit(5);
        return { notifications: rows, source: 'agrivoice_postgres' };
      },
    },
    {
      name: 'list_saved_listings',
      description: 'Lists the authenticated farmer active produce sell listings.',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async (session: VoiceSessionContext) => {
        const profile = await assertFarmerContext(session.userId);
        const rows = await db
          .select({
            id: buyerListings.id,
            cropName: buyerListings.cropName,
            quantityQuintals: buyerListings.quantityQuintals,
            expectedPriceInr: buyerListings.expectedPriceInr,
            status: buyerListings.status,
          })
          .from(buyerListings)
          .where(eq(buyerListings.farmerId, profile.id))
          .orderBy(desc(buyerListings.createdAt))
          .limit(5);
        return { listings: rows, source: 'agrivoice_postgres' };
      },
    },
    {
      name: 'get_weather',
      description: 'Retrieves latest weather observation for the authenticated farmer primary farm.',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async (session: VoiceSessionContext) => {
        const profile = await assertFarmerContext(session.userId);
        const [farm] = await db.select().from(farms).where(eq(farms.farmerId, profile.id)).limit(1);
        if (!farm) {
          return { available: false, reason: 'No farm registered for this farmer.' };
        }
        const [obs] = await db
          .select()
          .from(weatherObservations)
          .where(eq(weatherObservations.locationId, farm.id))
          .orderBy(desc(weatherObservations.observedAt))
          .limit(1);
        if (!obs) {
          return { available: false, farmName: farm.farmName, reason: 'No recent cached weather observation.' };
        }
        return {
          available: true,
          farmName: farm.farmName,
          temperatureC: obs.temperature !== null ? Number(obs.temperature) : null,
          humidityPct: obs.humidity !== null ? Number(obs.humidity) : null,
          rainfallMm: obs.rainfall !== null ? Number(obs.rainfall) : 0,
          observedAt: obs.observedAt,
          source: 'agrivoice_weather_cache',
        };
      },
    },
    {
      name: 'get_market_price',
      description: 'Searches recorded mandi market prices by commodity and optional district.',
      parameters: {
        type: 'object',
        properties: {
          commodity: { type: 'string', description: 'Crop or commodity name, e.g., Paddy, Chilli, Cotton' },
          district: { type: 'string', description: 'Optional district name' },
        },
        required: ['commodity'],
      },
      execute: async (session: VoiceSessionContext, args: any) => {
        await assertFarmerContext(session.userId);
        const commodity = String(args.commodity || '').trim();
        if (!commodity) throw new Error('commodity is required');
        const conditions = [ilike(marketPriceObservations.commodity, `%${commodity}%`)];
        if (args.district) {
          conditions.push(ilike(marketPriceObservations.district, `%${String(args.district).trim()}%`));
        }
        const rows = await db
          .select({
            commodity: marketPriceObservations.commodity,
            marketName: marketPriceObservations.marketName,
            district: marketPriceObservations.district,
            modalPriceInr: marketPriceObservations.modalPriceInr,
            unit: marketPriceObservations.unit,
            priceDate: marketPriceObservations.priceDate,
            source: marketPriceObservations.source,
          })
          .from(marketPriceObservations)
          .where(and(...conditions))
          .orderBy(desc(marketPriceObservations.priceDate))
          .limit(5);
        return {
          prices: rows,
          available: rows.length > 0,
          note: rows.length === 0 ? 'No matching mandi price observations found in AgriVoice database.' : undefined,
        };
      },
    },
    {
      name: 'get_soil_health_card',
      description: 'Retrieves the latest Soil Health Card stored for the farmer (or reports if live gov SHC API is unavailable).',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async (session: VoiceSessionContext) => {
        const profile = await assertFarmerContext(session.userId);
        const [latest] = await db
          .select()
          .from(soilReports)
          .where(eq(soilReports.farmerId, profile.id))
          .orderBy(desc(soilReports.reportDate))
          .limit(1);
        const govConfigured = Boolean(process.env.GOV_DATA_API_KEY && !process.env.GOV_DATA_API_KEY.includes('placeholder') && process.env.SHC_API_BASE_URL);
        if (!latest) {
          return {
            available: false,
            govApiConfigured: govConfigured,
            message: govConfigured
              ? 'No stored Soil Health Card found.'
              : 'No stored Soil Health Card found, and official Government SHC API access is not configured.',
          };
        }
        return {
          available: true,
          cardId: latest.cardId,
          ph: latest.ph,
          nitrogen: latest.nitrogen,
          phosphorus: latest.phosphorus,
          potassium: latest.potassium,
          zinc: latest.zinc,
          source: latest.source,
          sourceAuthority: latest.sourceAuthority,
          govApiConfigured: govConfigured,
        };
      },
    },
    {
      name: 'get_agricultural_advisory',
      description: 'Retrieves latest farm crop advisories and ICAR/KVK extension bulletins.',
      parameters: {
        type: 'object',
        properties: { crop: { type: 'string', description: 'Optional crop name' } },
        required: [],
      },
      execute: async (session: VoiceSessionContext, args: any) => {
        const profile = await assertFarmerContext(session.userId);
        const advisories = await db
          .select({ advisoryText: cropAdvisories.advisoryText, severity: cropAdvisories.severity, generatedAt: cropAdvisories.generatedAt })
          .from(cropAdvisories)
          .where(eq(cropAdvisories.farmerId, profile.id))
          .orderBy(desc(cropAdvisories.generatedAt))
          .limit(3);

        const bulletins = args.crop
          ? await db
              .select({ title: extensionBulletins.title, recommendationText: extensionBulletins.recommendationText, sourceAuthority: extensionBulletins.sourceAuthority })
              .from(extensionBulletins)
              .where(ilike(extensionBulletins.crop, `%${String(args.crop).trim()}%`))
              .limit(3)
          : await db
              .select({ title: extensionBulletins.title, recommendationText: extensionBulletins.recommendationText, sourceAuthority: extensionBulletins.sourceAuthority })
              .from(extensionBulletins)
              .limit(3);

        return { advisories, bulletins, source: 'agrivoice_advisory_and_icar_reference' };
      },
    },
    {
      name: 'search_available_buyers',
      description: 'Searches eligible registered produce buyers by district or state without exposing raw phone numbers.',
      parameters: {
        type: 'object',
        properties: {
          district: { type: 'string', description: 'District name' },
        },
        required: [],
      },
      execute: async (session: VoiceSessionContext, args: any) => {
        await assertFarmerContext(session.userId);
        const conditions = [eq(buyerProfiles.status, 'active')];
        if (args.district) {
          conditions.push(ilike(buyerProfiles.district, `%${String(args.district).trim()}%`));
        }
        const buyers = await db
          .select({
            buyerId: buyerProfiles.id,
            businessName: buyerProfiles.businessName,
            businessType: buyerProfiles.businessType,
            city: buyerProfiles.city,
            district: buyerProfiles.district,
            state: buyerProfiles.state,
            verificationStatus: buyerProfiles.verificationStatus,
          })
          .from(buyerProfiles)
          .where(and(...conditions))
          .limit(5);
        return { buyers, count: buyers.length };
      },
    },
    {
      name: 'get_buyer_listing',
      description: 'Retrieves details for a specific produce listing owned by the authenticated farmer.',
      parameters: {
        type: 'object',
        properties: { listingId: { type: 'string', description: 'UUID of the farmer produce listing' } },
        required: ['listingId'],
      },
      execute: async (session: VoiceSessionContext, args: any) => {
        const profile = await assertFarmerContext(session.userId);
        const [listing] = await db
          .select()
          .from(buyerListings)
          .where(and(eq(buyerListings.id, String(args.listingId)), eq(buyerListings.farmerId, profile.id)))
          .limit(1);
        if (!listing) {
          return { found: false, message: 'Listing not found or does not belong to this farmer.' };
        }
        return { found: true, listing };
      },
    },
    {
      name: 'request_buyer_connection',
      description:
        'Records an authorized farmer request to connect with an eligible buyer after farmer confirmation. Never initiates an unverified outbound call.',
      parameters: {
        type: 'object',
        properties: {
          buyerId: { type: 'string', description: 'Verified Buyer Profile UUID' },
          cropName: { type: 'string', description: 'Crop name' },
          quantityQuintals: { type: 'number', description: 'Quantity in quintals' },
          confirmedByFarmer: { type: 'boolean', description: 'Must be true only after farmer explicitly confirms' },
        },
        required: ['buyerId', 'cropName', 'quantityQuintals', 'confirmedByFarmer'],
      },
      execute: async (session: VoiceSessionContext, args: any) => {
        const profile = await assertFarmerContext(session.userId);
        if (args.confirmedByFarmer !== true) {
          return {
            connected: false,
            requiresConfirmation: true,
            message: 'Ask the farmer to explicitly confirm connecting with this buyer before recording the request.',
          };
        }

        const [buyer] = await db
          .select()
          .from(buyerProfiles)
          .where(and(eq(buyerProfiles.id, String(args.buyerId)), eq(buyerProfiles.status, 'active')))
          .limit(1);

        if (!buyer) {
          return { connected: false, message: 'Selected buyer is not active or eligible.' };
        }

        // Ensure farmer has an open listing or create a voice-initiated listing
        let [listing] = await db
          .select()
          .from(buyerListings)
          .where(and(eq(buyerListings.farmerId, profile.id), eq(buyerListings.status, 'open')))
          .limit(1);

        if (!listing) {
          [listing] = await db
            .insert(buyerListings)
            .values({
              farmerId: profile.id,
              cropName: String(args.cropName).trim(),
              quantityQuintals: Number(args.quantityQuintals).toString(),
              expectedPriceInr: '0',
              district: profile.district,
              state: profile.state,
              status: 'open',
              notes: 'Created via AgriVoice phone assistant buyer-connection request',
            })
            .returning();
        }

        const [reqRecord] = await db
          .insert(purchaseRequests)
          .values({
            listingId: listing.id,
            buyerId: buyer.id,
            farmerId: profile.id,
            requestType: 'enquiry',
            requestedQuantityQuintals: Number(args.quantityQuintals).toString(),
            offeredPriceInr: listing.expectedPriceInr,
            message: `Farmer ${profile.fullName} requested buyer connection via AgriVoice for ${args.cropName} (${args.quantityQuintals} qtl).`,
            status: 'pending',
          })
          .returning();

        await db.insert(notifications).values({
          userId: buyer.userId,
          role: 'buyer',
          category: 'market',
          title: 'Farmer Connection Request (Voice)',
          message: `${profile.fullName} (${profile.district}) requested to connect regarding ${args.cropName} (${args.quantityQuintals} qtl).`,
          relatedEntityId: reqRecord.id,
        });

        const dynamicTransferEnabled = process.env.EXOTEL_DYNAMIC_TRANSFER_ENABLED === 'true';
        return {
          connected: true,
          requestId: reqRecord.id,
          buyerBusinessName: buyer.businessName,
          transferMode: dynamicTransferEnabled ? 'handover_ready' : 'enquiry_recorded',
          message: dynamicTransferEnabled
            ? `Enquiry recorded and handover prepared for ${buyer.businessName}.`
            : `Enquiry recorded for ${buyer.businessName} in the AgriVoice Buyer Portal. Live call transfer is disabled until Exotel transfer applet is configured.`,
        };
      },
    },
    {
      name: 'end_call',
      description: 'Marks the voice call for polite termination when the farmer says goodbye or wants to hang up.',
      parameters: {
        type: 'object',
        properties: { reason: { type: 'string' } },
        required: [],
      },
      execute: async () => ({ shouldEndCall: true }),
    },
    {
      name: 'request_human_assistance',
      description: 'Logs a request for human agricultural extension or support follow-up.',
      parameters: {
        type: 'object',
        properties: { topic: { type: 'string' } },
        required: ['topic'],
      },
      execute: async (session: VoiceSessionContext, args: any) => {
        await db.insert(notifications).values({
          userId: session.userId,
          role: 'farmer',
          category: 'system',
          title: 'Human Assistance Requested (Voice)',
          message: `Topic: ${String(args.topic || 'General support')}`,
        });
        return { handoverRequested: true, message: 'Human assistance request logged in your notifications.' };
      },
    },
  ];

  for (const tool of tools) {
    if (!voiceDispatcher.hasTool(tool.name)) {
      voiceDispatcher.registerTool(tool);
    }
  }
}
