'use client';

import { useState, useCallback } from 'react';

interface LocationResult {
  country: string;
  city?: string;
  loading: boolean;
  error: string | null;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

export function useGeolocation() {
  const [result, setResult] = useState<LocationResult>({
    country: '',
    loading: false,
    error: null
  });

  const getCountryFromCoords = useCallback(async (coords: Coordinates): Promise<string> => {
    try {
      // Usar API gratuita de reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=5&accept-language=pt`
      );
      
      if (!response.ok) {
        throw new Error('Erro ao buscar localização');
      }
      
      const data = await response.json();
      
      // Extrair país do endereço
      const country = data.address?.country || data.display_name?.split(',').pop()?.trim() || '';
      
      return country;
    } catch (error) {
      console.error('Erro no reverse geocoding:', error);
      // Fallback: usar código do país baseado nas coordenadas aproximadas
      return getCountryFallback(coords);
    }
  }, []);

  const getCountryFallback = (coords: Coordinates): string => {
    const { latitude, longitude } = coords;
    
    // Portugal continental
    if (latitude >= 36.9 && latitude <= 42.2 && longitude >= -9.5 && longitude <= -6.2) {
      return 'Portugal';
    }
    // Açores
    if (latitude >= 36.5 && latitude <= 40 && longitude >= -31.5 && longitude <= -24.5) {
      return 'Portugal';
    }
    // Madeira
    if (latitude >= 32.2 && latitude <= 33.2 && longitude >= -17.3 && longitude <= -16.2) {
      return 'Portugal';
    }
    // Espanha
    if (latitude >= 35.9 && latitude <= 43.8 && longitude >= -9.3 && longitude <= 4.4) {
      return 'Espanha';
    }
    // França
    if (latitude >= 42.3 && latitude <= 51.1 && longitude >= -4.8 && longitude <= 8.2) {
      return 'França';
    }
    // Alemanha
    if (latitude >= 47.3 && latitude <= 55.1 && longitude >= 5.9 && longitude <= 15.0) {
      return 'Alemanha';
    }
    // Itália
    if (latitude >= 35.5 && latitude <= 47.1 && longitude >= 6.6 && longitude <= 18.5) {
      return 'Itália';
    }
    // Bélgica
    if (latitude >= 49.5 && latitude <= 51.5 && longitude >= 2.5 && longitude <= 6.4) {
      return 'Bélgica';
    }
    // Holanda
    if (latitude >= 50.8 && latitude <= 53.5 && longitude >= 3.4 && longitude <= 7.2) {
      return 'Holanda';
    }
    // Polônia
    if (latitude >= 49.0 && latitude <= 54.9 && longitude >= 14.1 && longitude <= 24.2) {
      return 'Polônia';
    }
    
    return 'Desconhecido';
  };

  const getLocation = useCallback(async (): Promise<LocationResult> => {
    setResult({ country: '', loading: true, error: null });
    
    // Verificar se geolocalização é suportada
    if (!navigator.geolocation) {
      const error = 'Geolocalização não suportada pelo navegador';
      setResult({ country: '', loading: false, error });
      return { country: '', loading: false, error };
    }
    
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          
          try {
            const country = await getCountryFromCoords(coords);
            const result = { country, loading: false, error: null };
            setResult(result);
            resolve(result);
          } catch (error) {
            const result = { country: '', loading: false, error: 'Erro ao identificar país' };
            setResult(result);
            resolve(result);
          }
        },
        (error) => {
          let errorMessage = 'Erro ao obter localização';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Localização indisponível';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tempo esgotado ao obter localização';
              break;
          }
          
          const result = { country: '', loading: false, error: errorMessage };
          setResult(result);
          resolve(result);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }, [getCountryFromCoords]);

  return {
    ...result,
    getLocation
  };
}
