import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

export const BackButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate(-1)}
      className="text-white/50 hover:text-blue-400 transition-colors"
    >
      <ArrowLeft className="w-5 h-5" />
    </Button>
  );
};

export default BackButton;
