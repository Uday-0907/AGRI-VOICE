import { eq, and, like } from 'drizzle-orm';
import { db } from '../../database/db.js';
import {
  farms,
  cropAdvisories,
  soilReports,
  inputVerifications,
  marketPriceObservations,
  buyerListings,
  machineryListings,
  machineryBookings,
  schemeApplications,
  farmerFieldQueries,
  notifications,
} from '../../database/schema/index.js';

/**
 * Safely and idempotently initializes clearly-labelled [Sample Record] presentation history
 * under the authenticated farmer's real farmerId and farmId in PostgreSQL.
 * Running this multiple times will never create duplicate records.
 */
export async function initializeFarmerSampleHistory(userId: string, farmerId: string, state: string, district: string) {
  const prefix = `SAMPLE-${farmerId.slice(0, 8)}`;

  // Check idempotency via existing sample soil report
  const existingSample = await db
    .select({ id: soilReports.id })
    .from(soilReports)
    .where(and(eq(soilReports.farmerId, farmerId), like(soilReports.reportId, `${prefix}%`)))
    .limit(1);

  if (existingSample.length > 0) {
    return { initialized: false, alreadyPresent: true, message: 'Sample presentation history is already initialized for this account.' };
  }

  const [farm] = await db
    .select()
    .from(farms)
    .where(eq(farms.farmerId, farmerId))
    .limit(1);

  const farmId = farm?.id || null;
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

  await db.transaction(async (tx) => {
    // 1. Weather Crop Advisories (when farm exists)
    if (farmId) {
      await tx.insert(cropAdvisories).values([
        {
          farmerId,
          farmId,
          severity: 'moderate',
          advisoryText: '[Sample Record] Maintain 2-3 cm standing water in paddy plots; schedule morning irrigation to reduce evaporation.',
          verificationStatus: 'generated',
          verificationNotes: 'Sample Record · AgriVoice Advisory Engine',
          status: 'active',
          validFrom: daysAgo(2),
          validTo: new Date(now.getTime() + 3 * 86400000),
          generatedAt: daysAgo(2),
        },
        {
          farmerId,
          farmId,
          severity: 'low',
          advisoryText: '[Sample Record] Apply split nitrogen dose only after checking 24-hour rainfall forecast to avoid runoff.',
          verificationStatus: 'generated',
          verificationNotes: 'Sample Record · AgriVoice Advisory Engine',
          status: 'active',
          validFrom: daysAgo(1),
          validTo: new Date(now.getTime() + 4 * 86400000),
          generatedAt: daysAgo(1),
        },
      ]);
    }

    // 2. Soil Reports & Input Verification
    await tx.insert(soilReports).values([
      {
        farmerId,
        farmId,
        cardId: `${prefix}-SHC-01`,
        reportId: `${prefix}-RPT-01`,
        source: 'sample_initialized',
        sourceAuthority: 'Sample Record · District Soil Testing Lab',
        testingDate: daysAgo(30),
        reportDate: daysAgo(30),
        state,
        district,
        soilType: 'Alluvial / Clay Loam',
        ph: '7.4',
        ec: '0.42',
        organicCarbon: '0.56',
        nitrogen: '195',
        phosphorus: '18',
        potassium: '285',
        zinc: '0.52',
        nutrientRatings: { ph: 'OPTIMAL', organicCarbon: 'MEDIUM', nitrogen: 'LOW', phosphorus: 'MEDIUM', potassium: 'HIGH', zinc: 'DEFICIENT' },
        recommendations: [
          { crop: 'Paddy / Rice', fertilizer: 'Urea (46% N)', dosageKgPerAcre: '45 kg/acre', note: 'Sample Record: Apply in 3 split doses.' },
          { crop: 'Paddy / Rice', fertilizer: 'Zinc Sulphate (21%)', dosageKgPerAcre: '10 kg/acre', note: 'Sample Record: Basal application for zinc deficiency.' },
        ],
        status: 'available',
        isDemo: 'false',
      },
      {
        farmerId,
        farmId,
        cardId: `${prefix}-SHC-02`,
        reportId: `${prefix}-RPT-02`,
        source: 'sample_initialized',
        sourceAuthority: 'Sample Record · Seasonal Baseline Check',
        testingDate: daysAgo(180),
        reportDate: daysAgo(180),
        state,
        district,
        soilType: 'Alluvial / Clay Loam',
        ph: '7.6',
        ec: '0.45',
        organicCarbon: '0.49',
        nitrogen: '175',
        phosphorus: '14',
        potassium: '260',
        zinc: '0.48',
        nutrientRatings: { ph: 'OPTIMAL', organicCarbon: 'LOW', nitrogen: 'LOW', zinc: 'DEFICIENT' },
        recommendations: [
          { crop: 'General', fertilizer: 'FYM / Compost', dosageKgPerAcre: '2 tons/acre', note: 'Sample Record: Improve organic carbon.' },
        ],
        status: 'available',
        isDemo: 'false',
      },
    ]);

    await tx.insert(inputVerifications).values({
      farmerId,
      productName: 'IFFCO Nano Urea (Sample Record)',
      category: 'fertilizer',
      brand: 'IFFCO',
      batchNumber: 'SAMPLE-BATCH-01',
      verificationStatus: 'inconclusive',
      provider: 'sample_initialized',
      notes: '[Sample Record] Initialized presentation entry. Official CIBRC/FCO live gateway requires configured credentials.',
    });

    // 3. Market Price Observations & Produce Listings
    await tx.insert(marketPriceObservations).values([
      {
        commodity: 'Paddy (Common)',
        variety: 'MTU-1010',
        state,
        district,
        marketName: `${district} APMC Yard`,
        minPriceInr: '2160',
        maxPriceInr: '2320',
        modalPriceInr: '2240',
        priceDate: daysAgo(1),
        source: 'sample_initialized',
        sourceAuthority: 'Sample Record · Local Mandi Observation',
        reportedByFarmerId: farmerId,
      },
      {
        commodity: 'Chilli (Dry)',
        variety: 'Teja',
        state,
        district,
        marketName: `${district} Spice Market`,
        minPriceInr: '14200',
        maxPriceInr: '15800',
        modalPriceInr: '15100',
        priceDate: daysAgo(3),
        source: 'sample_initialized',
        sourceAuthority: 'Sample Record · Local Mandi Observation',
        reportedByFarmerId: farmerId,
      },
    ]);

    await tx.insert(buyerListings).values([
      {
        farmerId,
        cropName: 'Paddy MTU-1010',
        variety: 'Kharif Grade A',
        quantityQuintals: '35',
        expectedPriceInr: '2280',
        qualityGrade: 'FAQ',
        district,
        state,
        status: 'open',
        notes: '[Sample Record] Moisture below 14%, ready for buyer pickup.',
      },
      {
        farmerId,
        cropName: 'Dry Chilli (Teja)',
        variety: 'Teja',
        quantityQuintals: '12',
        expectedPriceInr: '15200',
        qualityGrade: 'Grade A',
        district,
        state,
        status: 'open',
        notes: '[Sample Record] Sun-dried lot packed in gunny bags.',
      },
    ]);

    // 4. Machinery Listing & Booking
    const [mach] = await tx
      .insert(machineryListings)
      .values({
        ownerFarmerId: farmerId,
        equipmentName: `Power Sprayer & Boom Kit (${district})`,
        category: 'sprayer',
        hourlyRateInr: '350',
        dailyRateInr: '2200',
        district,
        state,
        availabilityStatus: 'available',
        description: '[Sample Record] Initialized equipment record for custom hiring.',
      })
      .returning();

    await tx.insert(machineryBookings).values({
      listingId: mach.id,
      renterFarmerId: farmerId,
      farmId,
      startDate: daysAgo(5),
      endDate: daysAgo(4),
      status: 'completed',
      notes: '[Sample Record] Completed seasonal spraying schedule.',
    });

    // 5. Scheme Application
    await tx.insert(schemeApplications).values({
      farmerId,
      schemeCode: 'PM-KISAN',
      schemeTitle: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
      category: 'subsidy',
      farmId,
      status: 'submitted',
      notes: '[Sample Record] Reference application record for presentation.',
      submittedAt: daysAgo(14),
    });

    // 6. Research Field Query
    await tx.insert(farmerFieldQueries).values({
      farmerId,
      crop: 'Paddy',
      topic: '[Sample Record] Zinc deficiency leaf bronzing',
      questionText: '[Sample Record] Observed reddish-brown spots on lower leaves 25 days after transplanting. Recommended foliar dose?',
      status: 'answered',
      answerText: 'Sample KVK Guidance: Apply 0.5% Zinc Sulphate + 0.25% lime foliar spray twice at 10-day intervals.',
      answeredBy: 'KVK Agronomy Desk (Sample Record)',
    });

    // 7. Welcome Notification
    await tx.insert(notifications).values({
      userId,
      role: 'farmer',
      category: 'system',
      title: 'Farmer Account & Sample History Ready',
      message: 'Your AgriVoice farmer profile is active with clearly-labelled [Sample Record] history across all six pillars.',
    });
  });

  return { initialized: true, alreadyPresent: false, message: 'Sample presentation history initialized across all pillars.' };
}
