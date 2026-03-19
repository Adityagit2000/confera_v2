import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

export const BackButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate(-1)}
      className="absolute top-6 left-6 z-50 text-muted-foreground hover:text-foreground flex items-center gap-2 transition-all hover:translate-x-[-4px]"
    >
      <ArrowLeft className="w-4 h-4" />
      <span>Back</span>
    </Button>
  );
};

export default BackButton;
