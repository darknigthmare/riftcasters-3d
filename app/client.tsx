import { createRoot } from 'react-dom/client';
import { RiftcastersExperience } from '@/components/game/RiftcastersExperience';
import './globals.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('RIFTCASTERS root element is missing.');
}

createRoot(root).render(<RiftcastersExperience />);
