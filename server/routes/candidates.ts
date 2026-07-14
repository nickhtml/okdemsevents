import { Router } from 'express';
import { getCandidates } from '../services/candidateScraper';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const candidates = await getCandidates();
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: "Failed to load candidates" });
  }
});

export default router;
