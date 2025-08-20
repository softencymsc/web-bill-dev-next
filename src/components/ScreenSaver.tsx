/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useState, useEffect, useContext } from 'react';
import { CounterContext } from '@/lib/CounterContext';
import { off, onValue, ref } from 'firebase/database';
import { rdb } from '../../firebase';

// Define interfaces for type safety
interface CarouselMedia {
  playtime: number;
  type: 'image' | 'video';
  src: string;
  alt: string;
}

interface ScreenSaverProps {
  onHide: () => void;
}

interface FirebaseData {
  imageDuration: number;
  videoDuration: number;
  media: Array<Array<{ type: 'image' | 'video'; url: string }>>;
}

const Carousel: React.FC<{ media: CarouselMedia[]; playtime: number }> = ({ media, playtime }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Array of possible slide directions
  const directions = [
    { initial: { opacity: 0, x: 100 }, exit: { opacity: 0, x: -100 } }, // right to left
    { initial: { opacity: 0, x: -100 }, exit: { opacity: 0, x: 100 } }, // left to right
    { initial: { opacity: 0, y: 100 }, exit: { opacity: 0, y: -100 } }, // bottom to top
    { initial: { opacity: 0, y: -100 }, exit: { opacity: 0, y: 100 } }, // top to bottom
  ];

  useEffect(() => {
    if (media.length === 0) return;

    const intervalId = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % media.length);
    }, playtime * 1000);

    return () => clearInterval(intervalId);
  }, [media, playtime]);

  if (media.length === 0) {
    return <div className="w-full h-full bg-gray-700 rounded-lg flex items-center justify-center text-white">No carousel media</div>;
  }

  // Randomly select a direction for each slide
  const randomDirection = directions[Math.floor(Math.random() * directions.length)];

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg">
      <AnimatePresence>
        <motion.div
          key={currentIndex}
          initial={randomDirection.initial}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={randomDirection.exit}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          {media[currentIndex].type === 'image' ? (
            <Image
              src={media[currentIndex].src}
              alt={media[currentIndex].alt}
              fill
              style={{ objectFit: 'cover' }}
              sizes="100vw"
              priority
              onError={() => console.error(`Failed to load image: ${media[currentIndex].src}`)}
            />
          ) : (
            <video
              src={media[currentIndex].src}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
              aria-label={media[currentIndex].alt}
              onError={() => console.error(`Failed to load video: ${media[currentIndex].src}`)}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const ScreenSaver: React.FC<ScreenSaverProps> = ({ onHide }) => {
  const { state } = useContext(CounterContext);
  const [carouselMedia, setCarouselMedia] = useState<CarouselMedia[]>([]);
  const [gridMedia, setGridMedia] = useState<Array<{ type: 'image' | 'video'; url: string; alt: string }>>([]);
  const [gridClass, setGridClass] = useState<string>('');
  const [layoutCount, setLayoutCount] = useState<number>(1);

  useEffect(() => {
    if (!state?.tenantId) {
      console.warn('Tenant ID is undefined, cannot fetch slider images');
      setCarouselMedia([]);
      setGridMedia([]);
      return;
    }

    const dbRef = ref(rdb, `Tnb/sliderImages`);

    const handleData = (snapshot: any) => {
      console.log('Firebase Data Snapshot:', snapshot.val());
      const data: FirebaseData = snapshot.val();
      if (!data || !data.media || !Array.isArray(data.media) || data.media.length === 0) {
        console.warn('Invalid or missing data from Firebase:', data);
        setCarouselMedia([]);
        setGridMedia([]);
        return;
      }

      // Set layout count based on number of arrays in media
      const layout = data.media.length;
      const validLayouts = [1, 2, 3, 4];
      const selectedLayout = validLayouts.includes(layout) ? layout : 1;
      setLayoutCount(selectedLayout);

      // Map first array to carousel media
      const media: CarouselMedia[] = (data.media[0] || []).map((item, index) => ({
        type: item.type,
        src: item.url,
        alt: `${item.type} ${index + 1}`,
        playtime: item.type === 'image' ? data.imageDuration || 5 : data.videoDuration || 5,
      }));

      // Map remaining arrays to grid media
      const gridMediaItems = data.media.slice(1).flat().map((item, index) => ({
        type: item.type,
        url: item.url,
        alt: `${item.type} ${index + 1}`,
      }));

      console.log('Carousel Media:', media);
      console.log('Grid Media:', gridMediaItems);
      setCarouselMedia(media);
      setGridMedia(gridMediaItems);

      // Set grid class based on layout
      let gridClass = 'grid-cols-1';
      switch (selectedLayout) {
        case 1:
          gridClass = 'grid-cols-1';
          break;
        case 2:
          gridClass = 'grid-cols-1 sm:grid-cols-2';
          break;
        case 3:
          gridClass = 'grid-cols-1 sm:grid-cols-2';
          break;
        case 4:
          gridClass = 'grid-cols-1 sm:grid-cols-2 grid-rows-2';
          break;
        default:
          gridClass = 'grid-cols-1';
      }
      setGridClass(gridClass);
    };

    onValue(dbRef, handleData, (error: any) => {
      console.error('Error fetching data from Firebase:', {
        message: error.message,
        code: error.code,
        details: error,
      });
      setCarouselMedia([]);
      setGridMedia([]);
    });

    return () => off(dbRef, 'value', handleData);
  }, [state?.tenantId]);

  if (!carouselMedia.length && !gridMedia.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        onClick={onHide}
        className="fixed inset-0 z-[1000] bg-gradient-to-b from-gray-900 via-gray-800 to-black grid gap-2 p-4 sm:p-6 cursor-pointer"
        aria-label="Click to dismiss screensaver"
      >
        <div className="w-full h-full flex items-center justify-center text-white text-lg">
          No media available
        </div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 z-[1001]">
          <Image
            src="/tnb4.png"
            alt="Cake Shop POS Logo"
            fill
            style={{ objectFit: 'contain' }}
            sizes="100vw"
            priority
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onClick={onHide}
      className="fixed inset-0 z-[1000] bg-gradient-to-b from-gray-900 via-gray-800 to-black grid gap-2 p-4 sm:p-6 cursor-pointer"
      style={{ gridTemplateRows: '1fr' }}
      aria-label="Click to dismiss screensaver"
    >
      <div
        className={`grid ${gridClass} gap-2 w-full h-full max-w-[100vw] max-h-[100vh]`}
        style={
          layoutCount === 3
            ? {
                gridTemplateAreas: `
                  "left right1"
                  "left right2"
                `,
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
              }
            : layoutCount === 4
            ? {
                gridTemplateAreas: `
                  "topLeft topRight"
                  "bottomLeft bottomRight"
                `,
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
              }
            : layoutCount === 2
            ? {
                gridTemplateAreas: `"left right"`,
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr',
              }
            : {}
        }
      >
        {carouselMedia.length > 0 && (
          <div
            className="relative w-full h-full max-w-[100vw] max-h-[100vh] rounded-lg overflow-hidden shadow-lg"
            style={
              layoutCount === 2
                ? { gridArea: 'left' }
                : layoutCount === 3
                ? { gridArea: 'left' }
                : layoutCount === 4
                ? { gridArea: 'topLeft' }
                : {}
            }
          >
            <Carousel
              media={carouselMedia}
              playtime={carouselMedia[0]?.playtime || 5}
            />
          </div>
        )}
        {layoutCount > 1 &&
          gridMedia.slice(0, layoutCount - 1).map((item, index) => (
            <div
              key={`grid-${index}`}
              className="relative w-full h-full max-w-[100vw] max-h-[100vh] rounded-lg overflow-hidden shadow-lg"
              style={
                layoutCount === 2
                  ? { gridArea: 'right' }
                  : layoutCount === 3
                  ? { gridArea: `right${index + 1}` }
                  : layoutCount === 4
                  ? { gridArea: index === 0 ? 'topRight' : index === 1 ? 'bottomLeft' : 'bottomRight' }
                  : {}
              }
            >
              {item.type === 'image' ? (
                <Image
                  src={item.url}
                  alt={item.alt}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="100vw"
                  priority
                  onError={() => console.error(`Failed to load image: ${item.url}`)}
                />
              ) : (
                <video
                  src={item.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                  aria-label={item.alt}
                  onError={() => console.error(`Failed to load video: ${item.url}`)}
                />
              )}
            </div>
          ))}
      </div>
    </motion.div>
  );
};

export default ScreenSaver;