import express from 'express';
import { getAgencyClients, getAgencyClientClaims, resolveADM } from '../controllers/agencyController';
import { getEmployeeRiskStatus, updateTravelPolicy } from '../controllers/corporateController';
import { protect } from '../middlewares/authMiddleware';

const agencyRouter = express.Router();
const corporateRouter = express.Router();

// Agency Routes
agencyRouter.get('/clients', protect, getAgencyClients);
agencyRouter.get('/claims', protect, getAgencyClientClaims);
agencyRouter.post('/adm/resolve', protect, resolveADM);

// Corporate Routes
corporateRouter.get('/employees/status', protect, getEmployeeRiskStatus);
corporateRouter.put('/policy', protect, updateTravelPolicy);

export { agencyRouter, corporateRouter };
