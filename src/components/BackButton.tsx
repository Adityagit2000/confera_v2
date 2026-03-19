import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

export const BackButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="link"
      onClick={() => navigate(-1)}
      className="flex items-center gap-2 text-[#64748b] hover:text-white group p-0 h-auto font-medium transition-all duration-200"
    >
      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
      <span>Back</span>
    </Button>
  );
};

export default BackButton;
