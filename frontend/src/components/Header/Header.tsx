import darkLogo from '../../assets/hai-build-dark-logo.png';
import { Link, useLocation } from 'react-router-dom';

export const Header = () => {
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 w-full bg-background/95 backdrop-blur-md py-3 shadow-md z-50 transition-all duration-200 border-b border-border/40">
      <div className="px-6 flex items-center">
        <div className="flex items-center gap-3">
          <Link to="/">
            <h2 className="text-xl md:text-2xl text-white font-normal">FACTIF AI</h2>
          </Link>
        </div>
        <div className="flex-1 flex justify-end items-center gap-6">
          <nav className="flex items-center gap-6">
            <Link 
              to="/" 
              className={`text-sm font-medium transition-colors hover:text-white ${
                location.pathname === '/' ? 'text-white' : 'text-gray-400'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/explore-mode" 
              className={`text-sm font-medium transition-colors hover:text-white ${
                location.pathname === '/explore-mode' ? 'text-white' : 'text-gray-400'
              }`}
            >
              Explore Mode
            </Link>
          </nav>
          <img src={darkLogo} alt="HAI Build Logo" className="h-6 w-auto ml-6" />
        </div>
      </div>
    </header>
  )
}
