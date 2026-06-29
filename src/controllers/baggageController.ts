import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Baggage from '../models/baggageModel';
import Claim from '../models/claimModel';
import { deleteFirebaseStorageFile, uploadBufferToFirebaseStorage } from '../services/storageService';

// @desc    Track a new bag (Scan/Manual)
// @route   POST /api/baggage
export const trackBaggage = async (req: AuthRequest, res: Response) => {
  try {
    const { tagNumber, flightNumber, route, currentLocation, eta } = req.body;
    const baggage = await Baggage.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      tagNumber,
      flightNumber,
      route,
      currentLocation,
      eta
    });
    res.status(201).json(baggage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get one baggage tracking item
// @route   GET /api/baggage/:id
export const getBaggageDetails = async (req: AuthRequest, res: Response) => {
  try {
    const baggage = await Baggage.findById(req.params.id);

    if (!baggage) {
      return res.status(404).json({ message: 'Baggage not found' });
    }

    if (baggage.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    res.json(baggage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update baggage tracking item
// @route   PATCH /api/baggage/:id
export const updateBaggage = async (req: AuthRequest, res: Response) => {
  try {
    const baggage = await Baggage.findById(req.params.id);

    if (!baggage) {
      return res.status(404).json({ message: 'Baggage not found' });
    }

    if (baggage.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const fields = ['tagNumber', 'flightNumber', 'route', 'currentLocation', 'eta', 'status'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        baggage[field] = req.body[field];
      }
    });

    await baggage.save();
    res.json(baggage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete baggage tracking item
// @route   DELETE /api/baggage/:id
export const deleteBaggage = async (req: AuthRequest, res: Response) => {
  try {
    const baggage = await Baggage.findById(req.params.id);

    if (!baggage) {
      return res.status(404).json({ message: 'Baggage not found' });
    }

    if (baggage.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await baggage.deleteOne();
    res.json({ message: 'Baggage tracking removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload baggage photo
// @route   POST /api/baggage/:id/photos
export const uploadBaggagePhoto = async (req: AuthRequest, res: Response) => {
  try {
    const baggage = await Baggage.findById(req.params.id);

    if (!baggage) {
      return res.status(404).json({ message: 'Baggage not found' });
    }

    if (baggage.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Photo file is required. Use multipart field "file".' });
    }

    const storedFile = await uploadBufferToFirebaseStorage(
      req.file,
      `baggage-photos/${baggage._id}`,
      req.user.firebaseId
    );

    const photo = {
      id: `${Date.now()}`,
      name: req.body.name || req.file.originalname,
      fileUrl: storedFile.url,
      storagePath: storedFile.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
    };

    baggage.photos = [...(baggage.photos || []), photo];
    await baggage.save();

    res.status(201).json(photo);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete baggage photo
// @route   DELETE /api/baggage/:id/photos/:photoId
export const deleteBaggagePhoto = async (req: AuthRequest, res: Response) => {
  try {
    const baggage = await Baggage.findById(req.params.id);

    if (!baggage) {
      return res.status(404).json({ message: 'Baggage not found' });
    }

    if (baggage.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const photo = (baggage.photos || []).find((item: any) => item.id === req.params.photoId);

    if (!photo) {
      return res.status(404).json({ message: 'Baggage photo not found' });
    }

    await deleteFirebaseStorageFile(photo.storagePath);
    baggage.photos = (baggage.photos || []).filter((item: any) => item.id !== req.params.photoId);
    await baggage.save();

    res.json({ message: 'Baggage photo removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user baggage tracking
// @route   GET /api/baggage
export const getBaggageList = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const query: any = { user: req.user._id };
    if (status && status !== 'All Bags') {
      query.status = status;
    }
    const bags = await Baggage.find(query).sort({ updatedAt: -1 });
    res.json(bags);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    File a PIR (Property Irregularity Report)
// @route   PUT /api/baggage/:id/pir
export const filePIR = async (req: AuthRequest, res: Response) => {
  try {
    const { bagDescription, incidentType } = req.body;
    const baggage = await Baggage.findById(req.params.id);
    if (!baggage) return res.status(404).json({ message: 'Baggage not found' });

    if (baggage.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    baggage.pirFiled = true;
    baggage.pirReference = `PIR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    baggage.bagDescription = bagDescription;
    baggage.incidentType = incidentType;
    baggage.status = incidentType; // Update status to Delayed/Lost/Damaged

    await baggage.save();
    res.json(baggage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get baggage analytics (Incidents, Recovery, etc.)
// @route   GET /api/baggage/analytics
export const getBaggageAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const bags = await Baggage.find({ user: req.user._id });
    const incidents = bags.filter(b => b.pirFiled);
    
    const claims = await Claim.find({ user: req.user._id });
    const baggageClaims = claims.filter((c: any) => 
      c.disruptionType === 'Baggage Loss' || 
      c.disruptionType === 'Baggage Delay' || 
      c.disruptionType === 'Damaged Baggage' ||
      c.type === 'Baggage'
    );
    
    let recovered = 0;
    let responseDays = 0;
    let resolvedBaggageClaims = 0;
    const airlines = new Set<string>();

    baggageClaims.forEach((claim: any) => {
      airlines.add(claim.airline || 'Unknown');
      if (claim.status === 'Resolved' || claim.status === 'Closed') {
         resolvedBaggageClaims++;
         recovered += (Number(claim.compensationAmount) || 0);
         if (claim.createdAt && claim.updatedAt) {
            const diffTime = Math.abs(new Date(claim.updatedAt).getTime() - new Date(claim.createdAt).getTime());
            responseDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         }
      }
    });

    const avgResponseTime = resolvedBaggageClaims > 0 ? (responseDays / resolvedBaggageClaims).toFixed(1) + ' days' : '0 days';
    const compensationRecovered = '₦' + (recovered > 0 ? (recovered / 1000).toFixed(0) + 'K' : '0');
    
    const airportStats: Record<string, number> = {};
    incidents.forEach(b => {
      const airport = b.currentLocation || 'Unknown';
      airportStats[airport] = (airportStats[airport] || 0) + 1;
    });

    const airportRankings = Object.keys(airportStats)
      .map(name => ({ name, incidents: airportStats[name] }))
      .sort((a, b) => b.incidents - a.incidents);

    res.json({
      totalIncidents: incidents.length,
      compensationRecovered,
      avgResponseTime,
      activeAirlines: airlines.size,
      airportRankings
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
