import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AlertCircle, BarChart, BookOpen, Calendar, Check, CheckCircle2, ChevronDown, ClipboardList, Clock, Cloud, Copy, Database, Download, Edit3, Home, Info, Plus, RefreshCw, Search, Settings, Sparkles, Trash2, TrendingUp, Upload, X } from 'lucide-react';
import { INITIAL_LECTURES } from './initialData';
import StableLottie from './components/StableLottie';
import ConstellationView from './components/ConstellationView';
import AnimatedNumber from './components/AnimatedNumber';



// 통화(원화) 안전 포맷터
function formatWon(val) {
  return (Number(val) || 0).toLocaleString();
}

// 날짜 표시용 포맷터 (M월 D일 (요일))
function formatDateDisplayFull(dateStr) {
  if (!dateStr) return '날짜 선택';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [_, y, m, d] = match;
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[dateObj.getDay()];
    return `${y}년 ${m}월 ${d}일 (${dayOfWeek})`;
  }
  return dateStr;
}

// 캘린더 매칭용 함수 (Korean 포맷, ISO 포맷 지원)
function matchesDate(lectureDate, targetYear, targetMonth, targetDay) {
  if (!lectureDate) return false;
  const match = lectureDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return Number(match[1]) === targetYear && Number(match[2]) === (targetMonth + 1) && Number(match[3]) === targetDay;
  }
  const koreanDateStr = `${targetMonth + 1}월 ${targetDay}일`;
  return lectureDate.replace(/\s+/g, '').includes(koreanDateStr.replace(/\s+/g, ''));
}

// 캘린더 선택일 매칭용 (Korean 포맷, ISO 포맷 지원)
function matchesCalendarDate(lectureDate, selectedCalendarDate) {
  if (!lectureDate || !selectedCalendarDate) return false;
  const match = lectureDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [_, y, m, d] = match;
    const cleanCal = selectedCalendarDate.replace(/\s+/g, '');
    const expectedCal = `${Number(m)}월${Number(d)}일`;
    return cleanCal.includes(expectedCal);
  }
  return lectureDate.replace(/\s+/g, '').includes(selectedCalendarDate.replace(/\s+/g, ''));
}

// 한국 공휴일 및 대체공휴일 체크 함수 (2025~2026년 기준)
function isKoreanHoliday(year, month, day) {
  // 양력 고정 공휴일 (month는 0-indexed: 0=1월, 1=2월, ...)
  if (month === 0 && day === 1) return true;   // 신정
  if (month === 2 && day === 1) return true;   // 삼일절
  if (month === 4 && day === 5) return true;   // 어린이날
  if (month === 5 && day === 6) return true;   // 현충일
  if (month === 7 && day === 15) return true;  // 광복절
  if (month === 9 && day === 3) return true;   // 개천절
  if (month === 9 && day === 9) return true;   // 한글날
  if (month === 11 && day === 25) return true; // 성탄절

  // 2025년 특정 음력 절기 및 대체공휴일
  if (year === 2025) {
    // 설날 연휴 (1월 28, 29, 30일)
    if (month === 0 && (day === 28 || day === 29 || day === 30)) return true;
    // 어린이날/석가탄신일 겹침에 따른 대체공휴일 (5월 6일)
    if (month === 4 && day === 6) return true;
    // 추석 연휴 (10월 5, 6, 7일) 및 대체공휴일 (10월 8일)
    if (month === 9 && (day === 5 || day === 6 || day === 7 || day === 8)) return true;
  }

  // 2026년 특정 음력 절기 및 대체공휴일
  if (year === 2026) {
    // 설날 연휴 (2월 16, 17, 18일)
    if (month === 1 && (day === 16 || day === 17 || day === 18)) return true;
    // 석가탄신일 대체공휴일 (5월 25일)
    if (month === 4 && day === 25) return true;
    // 추석 연휴 (9월 24, 25, 26일) 및 대체공휴일 (9월 28일)
    if (month === 8 && (day === 24 || day === 25 || day === 26 || day === 28)) return true;
  }

  return false;
}

// 다음 달 계산 유틸리티 (12월 다음은 1월)
function getNextMonthString() {
  const now = new Date();
  let nextMonth = now.getMonth() + 2; // getMonth()는 0~11 이므로 +1이 당월, +2가 익월
  if (nextMonth > 12) {
    nextMonth = 1;
  }
  return `${nextMonth}월`;
}

// 안전한 로컬 스토리지 래퍼 (모바일 사파리 사설 브라우징/인앱 브라우저 예외 방지)
const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage.getItem error:", e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage.setItem error:", e);
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("localStorage.clear error:", e);
    }
  }
};

// 클립보드 복사 헬퍼 (모바일 인앱 브라우저 등 navigator.clipboard 미지원 대비 fallback 제공)
const fallbackCopy = (text, onSuccess) => {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful && onSuccess) {
      onSuccess();
    }
  } catch (err) {
    console.error("Fallback copy failed:", err);
  }
};

const copyToClipboard = (text, onSuccess) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          if (onSuccess) onSuccess();
        })
        .catch((err) => {
          console.error("Clipboard API writeText failed, trying fallback:", err);
          fallbackCopy(text, onSuccess);
        });
    } else {
      fallbackCopy(text, onSuccess);
    }
  } catch (err) {
    console.error("Clipboard copy error, trying fallback:", err);
    fallbackCopy(text, onSuccess);
  }
};

// ── React Bits: BlurText Component ──
function BlurText({ text }) {
  if (!text) return null;
  return (
    <span className="inline-block">
      {text.split('').map((char, idx) => (
        <span
          key={idx}
          className="blur-char"
          style={{
            animationDelay: `${idx * 30}ms`,
            whiteSpace: char === ' ' ? 'pre' : 'normal'
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

// ── React Bits: ShinyText Component ──
function ShinyText({ text, className = '' }) {
  return (
    <span className={`shiny-text ${className}`}>
      {text}
    </span>
  );
}

// KST (한국 표준시) 오늘 날짜 구하기 (YYYY-MM-DD)
const getKstToday = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 60 * 60 * 1000));
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function App() {

  // 모바일 앱용 탭 상태 ('home', 'stats', 'sync', 'settings')
  const [activeTab, setActiveTab] = useState('home');

  // 강의 데이터 상태 (Moved here to prevent TDZ in useEffect hooks)
  const [lectures, setLectures] = useState(() => {
    const saved = safeLocalStorage.getItem('lectures');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(l => l && typeof l === 'object');
        }
      } catch (e) {
        console.error("Failed to parse cached lectures", e);
      }
    }
    return INITIAL_LECTURES;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const skipNextSyncRef = useRef(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);

  useEffect(() => {
    const hideUntil = safeLocalStorage.getItem('lectoss_notice_hide_until');
    const now = Date.now();
    if (!hideUntil || now > Number(hideUntil)) {
      setIsNoticeOpen(true);
    }
  }, []);

  const handleHide7Days = () => {
    const nextWeek = Date.now() + 7 * 24 * 60 * 60 * 1000;
    safeLocalStorage.setItem('lectoss_notice_hide_until', String(nextWeek));
    setIsNoticeOpen(false);
  };

  const handleCloseNotice = () => {
    setIsNoticeOpen(false);
  };

  // Scroll to top on tab change (target tab body container for full support)
  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      const container = document.getElementById('tab-body-container');
      if (container) {
        container.scrollTop = 0;
      }
    };
    resetScroll();
    const timer = setTimeout(resetScroll, 10);
    return () => clearTimeout(timer);
  }, [activeTab]);
  const [prevTab, setPrevTab] = useState(null); // for slide direction

  // 자주 쓰는 프리셋 데이터 상태 (이모지 제거, 역할[role] 필드 보강)
  const [presets, setPresets] = useState(() => {
    const saved = safeLocalStorage.getItem('lectoss_presets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // 기존 대괄호가 있는 프리셋 명칭 정리 (예: [🌱] 디지털새싹 -> 🌱 디지털새싹)
          return parsed.map(p => {
            if (p && p.name && p.name.startsWith('[') && p.name.includes(']')) {
              const match = p.name.match(/^\[(.*?)\]\s*(.*)/);
              if (match) {
                return { ...p, name: `${match[1]} ${match[2]}` };
              }
            }
            return p;
          });
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  useEffect(() => {
    safeLocalStorage.setItem('lectoss_presets', JSON.stringify(presets));
  }, [presets]);

  const applyPreset = (preset) => {
    setFormData(prev => ({
      ...prev,
      institution: preset.name,
      role: preset.role || 'Main',
      rate: preset.rate,
      classes: preset.classes,
      transportFee: preset.transportFee,
      taxRate: preset.taxRate,
      date: prev.date || getKstToday()
    }));
  };

  // 캘린더용 상태 및 계산 변수 (좌우 슬라이드/이동 가능하도록)
  const [calDate, setCalDate] = useState(new Date());
  const [calTransition, setCalTransition] = useState(''); // 'slide-left' | 'slide-right' | ''
  const currentYear = calDate.getFullYear();
  const currentMonth = calDate.getMonth();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCalTransition('slide-left');
    setCalDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setTimeout(() => setCalTransition(''), 300);
  };

  const handleNextMonth = () => {
    setCalTransition('slide-right');
    setCalDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setTimeout(() => setCalTransition(''), 300);
  };

  const [calTouchStart, setCalTouchStart] = useState(null);
  const handleCalTouchStart = (e) => {
    setCalTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };
  const handleCalTouchEnd = (e) => {
    if (!calTouchStart) return;
    const diffX = e.changedTouches[0].clientX - calTouchStart.x;
    const diffY = e.changedTouches[0].clientY - calTouchStart.y;
    
    // 가로 스와이프 거리가 세로 스크롤 거리보다 1.5배 이상 클 때만 월 전환 실행 (오동작 방지)
    if (Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 60) {
        handlePrevMonth(); // 오른쪽 드래그 -> 이전 달
      } else if (diffX < -60) {
        handleNextMonth(); // 왼쪽 드래그 -> 다음 달
      }
    }
    setCalTouchStart(null);
  };

  // 모바일 카드 스와이프 상태
  const [swipeActiveId, setSwipeActiveId] = useState(null);
  const [touchStart, setTouchStart] = useState(0);
  const [touchOffset, setTouchOffset] = useState(0);

  // 영수증 상세 아이템
  const [receiptItem, setReceiptItem] = useState(null);

  // 달력 선택 날짜 (상세 모바일 바텀시트 전용)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);


  // 파일 업로드 모션 상태
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // 설정 탭 토글 아코디언 상태
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [isCloudBackupOpen, setIsCloudBackupOpen] = useState(false);
  const [isLocalBackupOpen, setIsLocalBackupOpen] = useState(false);
  const [isAppSupportOpen, setIsAppSupportOpen] = useState(false);
  
  // 설정 탭 임시 입력 값 상태 (Controlled Inputs용)
  const [tempApiKey, setTempApiKey] = useState(() => safeLocalStorage.getItem('gemini_api_key') || '');
  const [tempSheetUrl, setTempSheetUrl] = useState(() => safeLocalStorage.getItem('google_sheet_url') || '');

  // 실정산액 직접 편집을 위한 상태
  const [editingNetCardId, setEditingNetCardId] = useState(null);
  const [editingNetValue, setEditingNetValue] = useState('');
  const [isNetEditModalOpen, setIsNetEditModalOpen] = useState(false);

  // 삭제 취소(Undo) 기능용 상태
  const [deletedLecture, setDeletedLecture] = useState(null);
  const [deletedLectureIndex, setDeletedLectureIndex] = useState(-1);
  const [undoProgress, setUndoProgress] = useState(0); // 0 to 100

  // 신규 추가 상태
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [recentlyPaidCardId, setRecentlyPaidCardId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // 토스트 타이머
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // 100ms 정밀 해상도 Undo 7초 타이머
  useEffect(() => {
    if (undoProgress <= 0) {
      if (undoProgress === 0) {
        setDeletedLecture(null);
        setDeletedLectureIndex(-1);
      }
      return;
    }
    const interval = setInterval(() => {
      setUndoProgress(prev => {
        const next = prev - (100 / 70); // 70 steps of 100ms = 7 seconds
        return next < 0 ? 0 : next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [undoProgress]);

  const handleUndoDelete = () => {
    if (deletedLecture) {
      setLectures(prev => {
        if (prev.some(l => l.id === deletedLecture.id)) return prev;
        return [deletedLecture, ...prev].sort((a, b) => {
          if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
          return b.id.localeCompare(a.id);
        });
      });
      setDeletedLecture(null);
      setUndoProgress(0);
      setDeletedLectureIndex(-1);
    }
  };

  // Lottie 애니메이션 타임아웃 참조
  const moneyLottieTimeoutRef = useRef(null);
  const moneyLottieFadeTimeoutRef = useRef(null);

  // 완료 처리된 카드 스크롤 참조
  const recentlyPaidCardRef = useRef(null);

  // sheetUrl의 최신값을 비동기 콜백에서 즉시 참조하기 위한 ref
  // (React 상태 업데이트는 비동기라 stale closure 문제가 생길 수 있음)
  const sheetUrlRef = useRef(sheetUrl);
  useEffect(() => { sheetUrlRef.current = sheetUrl; }, [sheetUrl]);

  // 기관 선택 필터 및 통계 스크롤 관리
  const [selectedInstitution, setSelectedInstitution] = useState('All');
  const chartScrollRef = useRef(null);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());


  // Tab order for slide direction
  const TAB_ORDER = ['home', 'calendar', 'stats', 'settings'];
  const getSlideClass = () => {
    if (!prevTab) return 'tab-enter-up';
    const prevIdx = TAB_ORDER.indexOf(prevTab);
    const currIdx = TAB_ORDER.indexOf(activeTab);
    return currIdx > prevIdx ? 'tab-enter-right' : 'tab-enter-left';
  };

  const switchTab = (tab) => {
    setPrevTab(activeTab);
    setActiveTab(tab);
  };

  // Scroll and mouse tracking for Google Labs DESIGN.md
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isNearIndex, setIsNearIndex] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress(window.scrollY / totalHeight);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const width = window.innerWidth;
      const xThreshold = width - 60; // 60px near right edge
      if (e.clientX >= xThreshold) {
        setIsNearIndex(true);
        setMouseY(e.clientY);
      } else {
        setIsNearIndex(false);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // 분석 탭 선택 or 연도 변경 시 가로 차트 스크롤 중앙 정렬 (올해: 현재월 기준, 지난 해: 가장 높은 정산액 기준)
  useEffect(() => {
    if (activeTab === 'stats' && chartScrollRef.current) {
      const timer = setTimeout(() => {
        const currentYear = new Date().getFullYear();
        let focusMonthIdx = 5; // 기본값: 6월 (중간)

        if (statsYear === currentYear) {
          focusMonthIdx = new Date().getMonth();
        } else {
          // 지난 해 또는 지지난해: 정산 총액이 가장 높은 월을 기준
          const yearLectures = lectures.filter(l => getLectureYear(l) === statsYear);

          if (yearLectures.length > 0) {
            const monthlyEarnings = Array(12).fill(0);
            yearLectures.forEach(l => {
              const dStr = l.date || '';
              const mMatch = dStr.match(/^\d{4}-(\d{2})-\d{2}$/) || dStr.match(/(\d+)월/);
              if (mMatch) {
                const mIdx = parseInt(mMatch[1], 10) - 1;
                if (mIdx >= 0 && mIdx < 12) {
                  const amt = l.isPaid ? (l.netAmount || 0) : (l.expectedAmount || 0);
                  monthlyEarnings[mIdx] += amt;
                }
              }
            });

            let maxAmt = -1;
            let maxIdx = 5;
            for (let i = 0; i < 12; i++) {
              if (monthlyEarnings[i] > maxAmt) {
                maxAmt = monthlyEarnings[i];
                maxIdx = i;
              }
            }
            focusMonthIdx = maxIdx;
          }
        }

        const svgWidth = 560;
        const step = svgWidth / 11;
        const targetX = focusMonthIdx * step;
        const containerWidth = chartScrollRef.current.clientWidth || 320;
        chartScrollRef.current.scrollLeft = targetX - containerWidth / 2;
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [activeTab, statsYear, lectures]);




  // 데이터 불러올 시 달력 자동 동기화 (최근 출강 날짜의 년/월로 달력 이동)
  useEffect(() => {
    if (lectures.length > 0) {
      const sorted = [...lectures].sort((a, b) => {
        const da = a.registrationDate ? new Date(a.registrationDate).getTime() : 0;
        const db = b.registrationDate ? new Date(b.registrationDate).getTime() : 0;
        return db - da;
      });
      const latest = sorted[0];
      const targetDateStr = latest.registrationDate || latest.date || '';
      if (targetDateStr) {
        let yr = new Date().getFullYear();
        let mo = new Date().getMonth();
        if (targetDateStr.includes('-')) {
          const d = new Date(targetDateStr);
          if (!isNaN(d.getTime())) { yr = d.getFullYear(); mo = d.getMonth(); }
        } else {
          const match = targetDateStr.match(/(\d+)월/);
          if (match) mo = parseInt(match[1], 10) - 1;
        }
        setCalDate(new Date(yr, mo, 1));
      }
    }
  }, [lectures]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  
  // 모달 제어
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLecture, setEditingLecture] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMockParseResult, setIsMockParseResult] = useState(false);
  const [globalLottie, setGlobalLottie] = useState(null);
  const [showMoneyLottie, setShowMoneyLottie] = useState(false);
  const [lottieFade, setLottieFade] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [activeMenuCardId, setActiveMenuCardId] = useState(null);



  // AI 및 설정 관련 상태
  const [apiKey, setApiKey] = useState(() => safeLocalStorage.getItem('gemini_api_key') || '');
  const [sheetUrl, setSheetUrl] = useState(() => safeLocalStorage.getItem('google_sheet_url') || '');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(() => safeLocalStorage.getItem('google_spreadsheet_url') || '');
  const [isInitialPullCompleted, setIsInitialPullCompleted] = useState(false);
  const [isEditingApiKey, setIsEditingApiKey] = useState(!apiKey);
  const [isEditingSheetUrl, setIsEditingSheetUrl] = useState(!sheetUrl);
  const [sheetUrlError, setSheetUrlError] = useState(null);
  const [isTestingSheetUrl, setIsTestingSheetUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeGuideCase, setActiveGuideCase] = useState('new'); // 'new' | 'existing'
  
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [parsedLectures, setParsedLectures] = useState([]);
  const [isAiVerifying, setIsAiVerifying] = useState(false);

  // 구글 시트 동기화 로딩 상태
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // 카드 토글 상태
  const [toggledCardIds, setToggledCardIds] = useState(new Set());

  // 모달 폼 상태
  const [formData, setFormData] = useState({
    institution: '',
    role: 'Main', // 'Main' | 'Assistant'
    rate: 100000,
    classes: 4,
    transportFee: 0,
    date: getKstToday(),
    registrationDate: getKstToday(),
    isPaid: false,
    taxRate: '3.3%',
    taxBase: 'LectureOnly',
    customTax: 0
  });

  const extractMonth = (dateStr) => {
    if (!dateStr) return '';
    if (/^\d{2}-\d{1,2}월$/.test(dateStr)) return dateStr;
    if (/^\d{1,2}월$/.test(dateStr)) return dateStr;

    const currentYear = new Date().getFullYear();
    
    // Format 2: "2026-06-30" (YYYY-MM-DD)
    const m2 = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) {
      const year = parseInt(m2[1], 10);
      const month = parseInt(m2[2], 10);
      if (year === currentYear) {
        return `${month}월`;
      } else {
        const shortYear = String(year).slice(-2);
        return `${shortYear}-${month}월`;
      }
    }

    // Format 4: "2025년 12월"
    const mYearMonth = dateStr.match(/(\d{4})년\s*(\d+)월/);
    if (mYearMonth) {
      const year = parseInt(mYearMonth[1], 10);
      const month = parseInt(mYearMonth[2], 10);
      if (year === currentYear) {
        return `${month}월`;
      } else {
        const shortYear = String(year).slice(-2);
        return `${shortYear}-${month}월`;
      }
    }

    const m1 = dateStr.match(/(\d+)월/);
    if (m1) return `${parseInt(m1[1], 10)}월`;
    
    const m3 = dateStr.match(/^(\d{1,2})-\d{1,2}$/);
    if (m3) return `${parseInt(m3[1], 10)}월`;
    
    return '';
  };

  const getLectureYear = (l) => {
    if (!l) return statsYear;
    // 1. Try registrationDate first (format YYYY-MM-DD)
    if (l.registrationDate && l.registrationDate.startsWith('20')) {
      const match = l.registrationDate.match(/^(\d{4})/);
      if (match) return parseInt(match[1], 10);
    }
    // 2. Try date (format YYYY-MM-DD)
    if (l.date && l.date.startsWith('20')) {
      const match = l.date.match(/^(\d{4})/);
      if (match) return parseInt(match[1], 10);
    }
    // 3. Try parsing year from month (if format is "25-12월")
    if (l.month && l.month.includes('-')) {
      const match = l.month.match(/^(\d+)-/);
      if (match) {
        const yy = parseInt(match[1], 10);
        return 2000 + yy; // e.g. 25 -> 2025
      }
    }
    // 4. Default to active statsYear if no year info is found
    return statsYear;
  };

  const uniqueMonths = Array.from(new Set(lectures.map(l => extractMonth(l?.date)).filter(Boolean))).sort((a, b) => {
    const isPrevYearA = a.includes('-');
    const isPrevYearB = b.includes('-');

    if (isPrevYearA && !isPrevYearB) return 1;
    if (!isPrevYearA && isPrevYearB) return -1;

    if (!isPrevYearA && !isPrevYearB) {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numB - numA;
    }

    const matchA = a.match(/^(\d+)-(\d+)월$/);
    const matchB = b.match(/^(\d+)-(\d+)월$/);
    
    if (matchA && matchB) {
      const yearA = parseInt(matchA[1], 10);
      const yearB = parseInt(matchB[1], 10);
      const monthA = parseInt(matchA[2], 10);
      const monthB = parseInt(matchB[2], 10);
      
      if (yearA !== yearB) {
        return yearB - yearA;
      }
      return monthB - monthA;
    }
    
    return a.localeCompare(b);
  });

  // 로컬 스토리지 데이터 동기화 및 구글 시트 백그라운드 자동 동기화(Push)
  const prevSheetUrlRef = useRef(sheetUrl);

  useEffect(() => {
    safeLocalStorage.setItem('lectures', JSON.stringify(lectures));
    
    if (sheetUrl) {
      if (!isInitialPullCompleted) {
        return;
      }
      if (prevSheetUrlRef.current !== sheetUrl) {
        // sheetUrl 자체가 변경된 것이면, 푸시를 하지 않고 단순히 레퍼런스만 업데이트
        prevSheetUrlRef.current = sheetUrl;
        return;
      }
      
      if (skipNextSyncRef.current) {
        // Pull 등 외부 연동에 의한 업데이트 시 중복 전송 방지
        skipNextSyncRef.current = false;
        return;
      }
      // 백그라운드 실시간 동기화 실행
      syncToGoogleSheetSilent(lectures);
    } else {
      prevSheetUrlRef.current = '';
    }
  }, [lectures, sheetUrl, isInitialPullCompleted]);

  // Reset card swipe offsets on filter or search changes to prevent rendering anomalies (Placed safely below state initialization)
  useEffect(() => {
    setSwipeActiveId(null);
    setTouchOffset(0);
  }, [searchQuery, selectedMonth]);

  // 최초 로드 시 시트 연동 되어있으면 백그라운드 데이터 풀
  useEffect(() => {
    if (sheetUrl) {
      setIsInitialPullCompleted(false);
      fetchFromGoogleSheetSilent();
    } else {
      setIsInitialPullCompleted(true);
    }
  }, [sheetUrl]);

  // 30초마다 백그라운드에서 구글 시트로부터 최신 데이터를 자동으로 가져옴 (visibilityState가 visible인 경우만 작동)
  useEffect(() => {
    if (!sheetUrl || !isInitialPullCompleted) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchFromGoogleSheetSilent();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [sheetUrl, isInitialPullCompleted]);

  // 자동 완성 추천 목록
  const uniqueInstitutions = Array.from(new Set(lectures.map(l => l?.institution).filter(Boolean))).sort((a, b) => a.localeCompare(b));



  // 세금 계산식
  const calculateFees = (rate, classes, transport, taxRate, taxBase, customTax, isPaid) => {
    const lectureFee = rate * classes;
    const expectedAmount = lectureFee + transport;
    
    const baseAmount = taxBase === 'LectureOnly' ? lectureFee : expectedAmount;
    let taxAmount = 0;

    if (taxRate === '3.3%') {
      taxAmount = Math.round(baseAmount * 0.033);
    } else if (taxRate === '8.8%') {
      taxAmount = Math.round(baseAmount * 0.088);
    } else if (taxRate === 'None') {
      taxAmount = 0;
    } else if (taxRate === 'Custom') {
      taxAmount = Number(customTax) || 0;
    }

    const deduction = -taxAmount;
    const netAmount = expectedAmount - taxAmount;

    return { expectedAmount, deduction, netAmount };
  };

  // 모달 폼 핸들러
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const updated = { ...prev, [name]: val };
      
      const rate = name === 'rate' ? Number(value) : updated.rate;
      const classes = name === 'classes' ? Number(value) : updated.classes;
      const transport = name === 'transportFee' ? Number(value) : updated.transportFee;
      
      if (name === 'institution') {
        const prevLecture = lectures.find(l => l.institution === value);
        if (prevLecture) {
          updated.rate = prevLecture.rate;
          updated.transportFee = prevLecture.transportFee;
          updated.taxRate = prevLecture.taxRate;
          updated.taxBase = prevLecture.taxBase || 'LectureOnly';
        }
      }

      return updated;
    });
  };



  // 설정 저장
  const handleSaveSettings = (geminiKey, sheetApiUrl, googleSpreadsheetUrl) => {
    safeLocalStorage.setItem('gemini_api_key', geminiKey);
    safeLocalStorage.setItem('google_sheet_url', sheetApiUrl);
    safeLocalStorage.setItem('google_spreadsheet_url', googleSpreadsheetUrl || '');
    setApiKey(geminiKey);
    setSheetUrl(sheetApiUrl);
    setSpreadsheetUrl(googleSpreadsheetUrl || '');
    setIsEditingApiKey(!geminiKey);
    setIsEditingSheetUrl(!sheetApiUrl);
    alert('설정이 저장되었습니다.');
  };

  const handleTestAndSaveSheetUrl = async (url, isDesktop = false) => {
    if (!url) {
      const confirmed = window.confirm(
        '구글 시트 연동을 해제하면 현재 대시보드의 모든 데이터가 즉시 초기화됩니다.\n\n계속하시겠습니까?'
      );
      if (!confirmed) return;

      // ① ref를 먼저 초기화 → 진행 중인 비동기 fetch가 완료되어도 상태 덮어쓰기 차단
      sheetUrlRef.current = '';

      // ② localStorage 즉시 초기화
      safeLocalStorage.setItem('google_sheet_url', '');
      safeLocalStorage.setItem('google_spreadsheet_url', '');
      safeLocalStorage.removeItem('lectures');

      // ③ React 상태 초기화
      setSheetUrl('');
      setSpreadsheetUrl('');
      setLectures([]);
      setIsEditingSheetUrl(true);
      setSheetUrlError(null);
      setIsInitialPullCompleted(true);
      if (isDesktop) setIsSettingsOpen(false);
      alert('구글 시트 연동이 해제되고 데이터가 초기화되었습니다.');
      return;
    }

    setIsTestingSheetUrl(true);
    setSheetUrlError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('웹 앱 응답 실패');
      }
      const data = await response.json();
      
      let retrievedSpreadsheetUrl = '';
      if (data && data.spreadsheetUrl) {
        retrievedSpreadsheetUrl = data.spreadsheetUrl;
      }
      
      handleSaveSettings(apiKey, url, retrievedSpreadsheetUrl);
      setSheetUrlError(null);
      if (isDesktop) setIsSettingsOpen(false);
    } catch (err) {
      console.error('Connection test failed:', err);
      setSheetUrlError({
        type: 'auth_required',
        message: '최초 연동을 위한 구글 권한 승인이 필요합니다. 아래 버튼을 눌러 승인 단계를 진행해 주세요.'
      });
    } finally {
      setIsTestingSheetUrl(false);
    }
  };

  // AI 분석 필드 변경
  const handleParsedFieldChange = (index, field, value) => {
    setParsedLectures(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      const rate = field === 'rate' ? Number(value) : item.rate;
      const classes = field === 'classes' ? Number(value) : item.classes;
      const transport = field === 'transportFee' ? Number(value) : item.transportFee;
      const taxRate = field === 'taxRate' ? value : item.taxRate;
      const taxBase = field === 'taxBase' ? value : item.taxBase;
      const customTax = field === 'customTax' ? Number(value) : item.customTax;
      const isPaid = field === 'isPaid' ? value : item.isPaid;

      const { expectedAmount, deduction, netAmount } = calculateFees(
        rate, classes, transport, taxRate, taxBase, customTax, isPaid
      );

      updated[index] = {
        ...item,
        rate,
        classes,
        transportFee: transport,
        expectedAmount,
        deduction,
        netAmount,
        isPaid
      };
      return updated;
    });
  };

  // AI 분석 저장
  const handleSaveParsedLectures = () => {
    setLectures(prev => [...parsedLectures, ...prev]);
    setIsAiVerifying(false);
    setIsAiModalOpen(false);
    setAiText('');
  };

  // 목업 분석 실행
  const handleMockParse = () => {
    const fullText = `[출강 공지]
디지털새싹 정보화교육 안내
1. 11/19(화) 09:00~12:00 (3차시) - 광주사회복지회관 (DX 교육)
- 단가: 100,000원, 교통비: 20,000원

2. 11/24(일) 14:00~16:00 (2차시) - 해남종합사회복지관
- 단가: 100,000원 (교통비 없음)`;

    setAiText('');
    setAiLoading(true);
    setAiError(null);
    setIsMockParseResult(true);

    let currentLength = 0;
    const intervalTime = 25; // ms per step (slower)
    const stepSize = 1; // type 1 character at a time (smoother and slower)
    
    const timer = setInterval(() => {
      currentLength += stepSize;
      if (currentLength >= fullText.length) {
        setAiText(fullText);
        clearInterval(timer);
        
        // After typing animation completes, transition to verification card list
        setTimeout(() => {
          const mockParsed = [
            {
              id: `mock-${Date.now()}-1`,
              institution: '사회복지협의회/광주사회복지회관',
              rate: 100000,
              classes: 3,
              transportFee: 20000,
              expectedAmount: 320000,
              deduction: -10560,
              netAmount: 309440,
              month: '11월',
              date: '11월 19일',
              registrationDate: new Date().toISOString().slice(0, 10),
              isPaid: false,
              taxRate: '3.3%',
              taxBase: 'LectureOnly',
              customTax: 0
            },
            {
              id: `mock-${Date.now()}-2`,
              institution: '해남종합사회복지관',
              rate: 100000,
              classes: 2,
              transportFee: 0,
              expectedAmount: 200000,
              deduction: -6600,
              netAmount: 193400,
              month: '11월',
              date: '11월 24일',
              registrationDate: new Date().toISOString().slice(0, 10),
              isPaid: false,
              taxRate: '3.3%',
              taxBase: 'LectureOnly',
              customTax: 0
            }
          ];
          setParsedLectures(mockParsed);
          setIsAiVerifying(true);
          setAiLoading(false);
        }, 1500); // 1.5 seconds transition delay so users have time to see it complete
      } else {
        setAiText(fullText.slice(0, currentLength));
      }
    }, intervalTime);
  };

  // AI 실제 분석
  const handleAiParse = async () => {
    if (!apiKey) {
      setAiError('Gemini API Key를 먼저 설정해주세요.');
      return;
    }
    if (!aiText.trim()) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `너는 강사들의 카카오톡 강의 일정 메시지를 읽고 정교한 JSON 데이터로 변환하는 비서야.
아래의 텍스트에서 강의 일정을 추출해서 JSON 배열로 반환해줘.

각 강의 일정 객체는 다음 필드를 가져야 해:
1. institution: 기관명 또는 학교명 (예: "사회복지협의회/목포경애원", "해남종합사회복지관" 등)
2. rate: 강의 시간당 단가 (숫자만, 예: 100000)
3. classes: 총 차시 또는 강의 시간 (숫자만, 예: 3)
4. transportFee: 교통비 (숫자만, 없으면 0)
5. date: 강의 날짜 (문자열, 예: "6월 19일")
6. month: 정산 기준 월 (문자열, 예: "6월" 또는 "25/11월")
7. registrationDate: 게시등록일 (문자열, YYYY-MM-DD 형식. 텍스트에서 알 수 없으면 오늘 날짜인 "${new Date().toISOString().slice(0, 10)}" 기재)
8. taxRate: 세율 (일반적인 복지관/사회복지협의회는 8.8% 기본 설정, 사기업은 3.3% 설정)
9. taxBase: 과세 기준 ("LectureOnly" 또는 "Total". 기본값 "LectureOnly")
10. isPaid: 정산 완료 여부 (기본 false)

[일정 등록 및 변환 규칙]
- 규칙 1: 정산 대기 상태('isPaid': false)의 실수령액을 0원으로 작성하지 않는다. (수수료/세금을 제한 실제 예상 수령액으로 정확하게 작성)
- 규칙 2: 정산 여부(입금 완료 등)가 명확하게 언급되지 않은 경우, 반드시 'isPaid': false (정산 대기) 상태로 등록한다.
- 규칙 3: 실수령액은 항상 [강의료 + 교통비 - 공제금액] 기준으로 계산한다.
- 규칙 4: 정산 대기는 "미정산"의 의미이지 "실수령 0원"의 의미가 아니므로, 모든 금액 계산식은 동일하게 정상 적용되어야 한다.

반환할 포맷:
[
  {
    "institution": "사회복지협의회/목포경애원",
    "rate": 100000,
    "classes": 3,
    "transportFee": 0,
    "date": "11월 19일",
    "month": "11월",
    "registrationDate": "2026-11-10",
    "taxRate": "8.8%",
    "taxBase": "LectureOnly",
    "isPaid": false
  }
]

분석할 텍스트:
"""
${aiText}
"""`
            }]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) throw new Error(`Gemini API 통신 실패 (${response.status})`);

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('텍스트 분석 결과가 비어있습니다.');

      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        const calculated = parsed.map((item, idx) => {
          const { expectedAmount, deduction, netAmount } = calculateFees(
            item.rate || 100000,
            item.classes || 2,
            item.transportFee || 0,
            item.taxRate || '3.3%',
            item.taxBase || 'LectureOnly',
            0,
            item.isPaid || false
          );
          return {
            id: `ai-${Date.now()}-${idx}`,
            institution: item.institution || '알 수 없는 학교',
            rate: item.rate || 100000,
            classes: item.classes || 2,
            transportFee: item.transportFee || 0,
            expectedAmount,
            deduction,
            netAmount,
            month: item.month || '6월',
            date: item.date || '6월 29일',
            registrationDate: item.registrationDate || new Date().toISOString().slice(0, 10),
            isPaid: item.isPaid || false,
            taxRate: item.taxRate || '3.3%',
            taxBase: item.taxBase || 'LectureOnly',
            customTax: 0
          };
        });
        setParsedLectures(calculated);
        setIsAiVerifying(true);
      } else {
        throw new Error('배열 포맷 파싱 에러');
      }
    } catch (err) {
      console.error(err);
      setAiError(err.message || 'AI 분석 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
    }
  };

  // 구글 시트 Pull
  const fetchFromGoogleSheet = async () => {
    if (!sheetUrl) return;
    setSyncLoading(true);
    setSyncMessage(null);

    try {
      const response = await fetch(sheetUrl);
      if (!response.ok) throw new Error('구글 시트 데이터를 가져올 수 없습니다. 웹 앱 배포 상태를 검토해 주세요.');
      
      const data = await response.json();
      let lecturesList = null;
      if (Array.isArray(data)) {
        lecturesList = data;
      } else if (data && Array.isArray(data.lectures)) {
        lecturesList = data.lectures;
        if (data.spreadsheetUrl) {
          safeLocalStorage.setItem('google_spreadsheet_url', data.spreadsheetUrl);
          setSpreadsheetUrl(data.spreadsheetUrl);
        }
      }

      if (lecturesList) {
        if (lecturesList.length === 0 && lectures.length > 0) {
          // 구글 시트는 비어있고 로컬에 데이터가 있는 경우 -> 로컬 데이터를 구글 시트에 백업(Push)
          syncToGoogleSheetSilent(lectures);
        } else {
          // 구글 시트에 데이터가 있거나 로컬도 비어있는 경우 -> 구글 시트 데이터로 로컬 덮어쓰기
          const mapped = lecturesList.map(row => ({
            id: String(row.id || Date.now() + Math.random()),
            institution: String(row.institution || '기타 기관'),
            rate: Number(row.rate) || 0,
            classes: Number(row.classes) || 0,
            expectedAmount: Number(row.expectedAmount) || 0,
            transportFee: Number(row.transportFee) || 0,
            deduction: Number(row.deduction) || 0,
            netAmount: Number(row.netAmount) || 0,
            month: String(row.month || '6월'),
            date: String(row.date || '6월 29일'),
            registrationDate: row.registrationDate ? String(row.registrationDate) : '',
            isPaid: String(row.isPaid) === 'true' || row.isPaid === true,
            taxRate: String(row.taxRate || '8.8%'),
            taxBase: String(row.taxBase || 'LectureOnly'),
            customTax: Number(row.customTax) || 0
          }));
          skipNextSyncRef.current = true;
          setLectures(mapped);
        }
        setIsInitialPullCompleted(true);
        setSyncMessage({ type: 'success', text: `구글 시트에서 ${lecturesList.length}개의 강의 내역을 동기화하여 가져왔습니다.` });
      } else {
        throw new Error('올바르지 않은 API 포맷');
      }
    } catch (err) {
      console.error(err);
      setSyncMessage({ type: 'error', text: err.message || '동기화 중 에러가 발생했습니다.' });
    } finally {
      setSyncLoading(false);
    }
  };

  // 백그라운드 silent fetch
  const fetchFromGoogleSheetSilent = async () => {
    try {
      const response = await fetch(sheetUrl);
      if (response.ok) {
        const data = await response.json();
        let lecturesList = null;
        if (Array.isArray(data)) {
          lecturesList = data;
        } else if (data && Array.isArray(data.lectures)) {
          lecturesList = data.lectures;
          if (data.spreadsheetUrl) {
            safeLocalStorage.setItem('google_spreadsheet_url', data.spreadsheetUrl);
            setSpreadsheetUrl(data.spreadsheetUrl);
          }
        }

        if (lecturesList) {
          // 연동 해제된 경우(sheetUrlRef가 비어있으면) 상태 업데이트 차단
          // → fetch가 완료되는 순간 이미 연동이 끊겼을 수 있으므로 stale closure 방지
          if (!sheetUrlRef.current) return;

          if (lecturesList.length === 0 && lectures.length > 0) {
            // 구글 시트는 비어있고 로컬에 데이터가 있는 경우 -> 로컬 데이터를 구글 시트에 백업(Push)
            syncToGoogleSheetSilent(lectures);
          } else {
            // 구글 시트에 데이터가 있거나 로컬도 비어있는 경우 -> 구글 시트 데이터로 로컬 덮어쓰기
            const mapped = lecturesList.map(row => ({
              id: String(row.id),
              institution: String(row.institution),
              rate: Number(row.rate) || 0,
              classes: Number(row.classes) || 0,
              expectedAmount: Number(row.expectedAmount) || 0,
              transportFee: Number(row.transportFee) || 0,
              deduction: Number(row.deduction) || 0,
              netAmount: Number(row.netAmount) || 0,
              month: String(row.month),
              date: String(row.date),
              registrationDate: row.registrationDate ? String(row.registrationDate) : '',
              isPaid: String(row.isPaid) === 'true' || row.isPaid === true,
              taxRate: String(row.taxRate),
              taxBase: String(row.taxBase || 'LectureOnly'),
              customTax: Number(row.customTax) || 0
            }));
            skipNextSyncRef.current = true;
            setLectures(mapped);
          }
          setIsInitialPullCompleted(true);
        }
      }
    } catch (e) {
      console.warn('Silent sync failed', e);
    }
  };

  // 백그라운드 실시간 동기화 (Push)
  const syncToGoogleSheetSilent = async (lecturesList) => {
    if (!sheetUrl) return;
    setIsSyncing(true);
    try {
      await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'sync_all', lectures: lecturesList })
      });
    } catch (e) {
      console.warn('Silent auto-sync push failed:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // 구글 시트 Push
  const syncToGoogleSheet = async (lecturesList) => {
    if (!sheetUrl) return;
    setSyncLoading(true);
    setSyncMessage(null);

    try {
      const response = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'sync_all', lectures: lecturesList })
      });

      if (!response.ok) throw new Error('시트 전송 실패');
      const resData = await response.json();
      if (resData.status === 'success') {
        setSyncMessage({ type: 'success', text: `기기의 내역 ${lecturesList.length}건을 구글 시트에 안전하게 백업했습니다.` });
      } else {
        throw new Error('시트 응답 에러');
      }
    } catch (err) {
      console.error(err);
      setSyncMessage({ type: 'error', text: err.message || '업로드 중 에러가 발생했습니다.' });
    } finally {
      setSyncLoading(false);
    }
  };

  // 수동 폼 서브밋
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 친절한 필수값 검증 및 자동 포커싱
    if (!formData.institution.trim()) {
      alert('기관 / 교육장명을 입력해 주세요.');
      const el = document.querySelector('input[name="institution"]');
      if (el) el.focus();
      return;
    }
    
    if (!formData.rate || Number(formData.rate) <= 0) {
      alert('시간당 강의 단가를 올바르게 입력해 주세요.');
      const el = document.querySelector('input[name="rate"]');
      if (el) el.focus();
      return;
    }

    if (Number(formData.rate) > 150000) {
      alert('시간당 강의 단가는 최대 15만원까지만 설정할 수 있습니다.');
      const el = document.querySelector('input[name="rate"]');
      if (el) el.focus();
      return;
    }

    if (Number(formData.classes) > 16) {
      alert('총 강의 시간(차시)은 최대 16차시까지만 선택할 수 있습니다.');
      const el = document.querySelector('select[name="classes"]');
      if (el) el.focus();
      return;
    }

    const { expectedAmount, deduction, netAmount } = calculateFees(
      Number(formData.rate),
      Number(formData.classes),
      Number(formData.transportFee),
      formData.taxRate,
      formData.taxBase,
      Number(formData.customTax),
      formData.isPaid
    );

    const now = new Date();
    const dateVal = formData.date || `${now.getMonth() + 1}월 ${now.getDate()}일`;

    const newLecture = {
      id: editingLecture ? editingLecture.id : String(Date.now()),
      institution: formData.institution,
      role: formData.role || 'Main',
      rate: Number(formData.rate),
      classes: Number(formData.classes),
      expectedAmount,
      transportFee: Number(formData.transportFee),
      deduction,
      netAmount,
      date: dateVal,
      month: extractMonth(dateVal),
      registrationDate: formData.registrationDate || new Date().toISOString().slice(0, 10),
      isPaid: formData.isPaid,
      taxRate: formData.taxRate,
      taxBase: formData.taxBase,
      customTax: Number(formData.customTax)
    };

    let updatedList;
    if (editingLecture) {
      updatedList = lectures.map(l => l.id === editingLecture.id ? newLecture : l);
    } else {
      updatedList = [newLecture, ...lectures];
    }

    setLectures(updatedList);
    setIsAddModalOpen(false);
    setEditingLecture(null);

    setFormData({
      institution: '',
      role: 'Main',
      rate: 100000,
      classes: 4,
      transportFee: 0,
      date: new Date().toISOString().slice(0, 10),
      registrationDate: new Date().toISOString().slice(0, 10),
      isPaid: false,
      taxRate: '3.3%',
      taxBase: 'LectureOnly',
      customTax: 0,
      _newPresetName: '',
      _newPresetRate: '',
      _newPresetRole: 'Main',
      _newPresetTax: '3.3%',
      _newPresetEmoji: null,
      _showEmojiPicker: false,
      _tab: 'record'
    });
  };

  // 즐겨찾기 신규 등록
  const handleAddPreset = () => {
    if (!formData.institution.trim()) {
      alert('기관명을 입력해 주세요.');
      return;
    }
    const newPreset = {
      id: `p-${Date.now()}`,
      name: formData.institution,
      role: formData.role || 'Main',
      rate: Number(formData.rate) || 100000,
      classes: Number(formData.classes) || 2,
      transportFee: Number(formData.transportFee) || 0,
      taxRate: formData.taxRate || '3.3%'
    };
    setPresets(prev => [...prev, newPreset]);
    alert('즐겨찾기 목록에 저장되었습니다.');
  };

  // 정산 여부 토글
  const handleTogglePaid = (lecture) => {
    const nextPaid = !lecture.isPaid;

    let updatedFields = { isPaid: nextPaid };

    if (nextPaid) {
      // 대기 → 완료: 실수령액 및 공제금액 새로 계산
      const { expectedAmount, deduction, netAmount } = calculateFees(
        lecture.rate,
        lecture.classes,
        lecture.transportFee,
        lecture.taxRate || '3.3%',
        lecture.taxBase || 'LectureOnly',
        lecture.customTax || 0,
        true
      );
      updatedFields.deduction = deduction;
      updatedFields.netAmount = netAmount;
      updatedFields.expectedAmount = expectedAmount;
    } else {
      // 완료 → 대기: 실수령액 / 공제금액 0으로 초기화 (정산대기 = 아직 미지급)
      updatedFields.netAmount = 0;
      updatedFields.deduction = 0;
    }

    const updatedList = lectures.map(l => {
      if (l.id === lecture.id) {
        return { ...l, ...updatedFields };
      }
      return l;
    });

    if (nextPaid) {
      setRecentlyPaidCardId(lecture.id);
      // 재정렬 후 DOM이 업데이트되면 해당 카드로 부드럽게 스크롤
      setTimeout(() => {
        if (recentlyPaidCardRef.current) {
          recentlyPaidCardRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 120);
      setTimeout(() => {
        setRecentlyPaidCardId(null);
      }, 4000);

      if (moneyLottieTimeoutRef.current) clearTimeout(moneyLottieTimeoutRef.current);
      if (moneyLottieFadeTimeoutRef.current) clearTimeout(moneyLottieFadeTimeoutRef.current);

      setShowMoneyLottie(true);
      setLottieFade(false);

      // 카칭 효과음 재생
      try {
        const audio = new Audio('/mp3/generic-ka-ching.mp3');
        audio.play().catch(e => console.log('Audio playback failed or blocked:', e));
      } catch (err) {
        console.error('Audio initialization failed:', err);
      }

      moneyLottieFadeTimeoutRef.current = setTimeout(() => {
        setLottieFade(true);
      }, 1400);

      moneyLottieTimeoutRef.current = setTimeout(() => {
        setShowMoneyLottie(false);
      }, 1900);
    }

    setLectures(updatedList);
  };

  // 삭제
  const handleDelete = (id) => {
    const idxInFiltered = filteredLectures.findIndex(l => l.id === id);
    const target = lectures.find(l => l.id === id);
    if (target) {
      setDeletedLecture(target);
      setDeletedLectureIndex(idxInFiltered !== -1 ? idxInFiltered : 0);
      setLectures(prev => prev.filter(l => l.id !== id));
      setUndoProgress(100);
    }
  };



  // 수정 진입

  const handleEditClick = (lecture) => {
    setEditingLecture(lecture);
    setFormData({
      institution: lecture.institution,
      role: lecture.role || 'Main',
      rate: lecture.rate,
      classes: lecture.classes,
      transportFee: lecture.transportFee,
      month: lecture.month,
      date: lecture.date,
      registrationDate: lecture.registrationDate || new Date().toISOString().slice(0, 10),
      isPaid: lecture.isPaid,
      taxRate: lecture.taxRate || '3.3%',
      taxBase: lecture.taxBase || 'LectureOnly',
      customTax: lecture.customTax || 0,
      _tab: 'record',
      _newPresetName: '',
      _newPresetRate: '',
      _newPresetRole: 'Main',
      _newPresetTax: '3.3%',
      _newPresetEmoji: null,
      _showEmojiPicker: false
    });

    setIsAddModalOpen(true);
  };

  // CSV 내보내기
  const handleExportCSV = () => {
    const headers = ['기관명/학교', '출강역할', '강의단가', '총 차시', '예상수령액', '교통비(+)', '공제율(%)', '공제금액(-)', '월', '실수령액', '날짜', '등록일', '정산여부'];
    const rows = lectures.map(l => [
      l.institution,
      l.role === 'Assistant' ? '보조강사' : '주강사',
      l.rate,
      l.classes,
      l.expectedAmount,
      l.transportFee || '',
      l.taxRate === 'None' ? '0' : (l.taxRate || '3.3').replace('%', '').trim(),
      l.deduction,
      l.month,
      l.isPaid ? l.netAmount : '',
      l.date,
      l.registrationDate || '',
      l.isPaid ? '정산완료' : '정산대기'
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `강의료_정산표_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSampleCSV = () => {
    const headers = ['기관명/학교', '출강역할', '강의단가', '총 차시', '예상수령액', '교통비(+)', '공제율(%)', '공제금액(-)', '월', '실수령액', '날짜', '등록일', '정산여부'];
    const rows = [
      ['창의융합/광주전남중', '주강사', '25000', '12', '300000', '0', '3.3', '-10660', '10월', '193400', '2025-10-15', '2025-10-15', '정산완료'],
      ['TMD교육/고흥동초B (1)', '보조강사', '50000', '3', '192000', '42000', '3.3', '-6335', '12월', '185665', '2025-12-10', '2025-12-10', '정산완료'],
      ['TMD교육/고흥동초A (1)', '보조강사', '50000', '3', '192000', '42000', '8.8', '-16896', '12월', '217104', '2025-12-11', '2025-12-11', '정산완료'],
      ['코딩 스피드 레이스!(3기 A반) - 청풍초등학교(3차시)', '보조강사', '50000', '3', '175787', '25787', '3.3', '-4950', '1월', '170837', '2026-01-12', '2026-01-12', '정산완료']
    ];

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `출강기록_양식예시.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV 가져오기
  const handleImportCSV = (file) => {
    if (!file) return;

    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const processCsvText = (text) => {
      const lines = text.split('\n');
      if (lines.length < 2) {
        alert("업로드된 CSV 파일에 데이터가 부족하거나 올바르지 않은 파일입니다.");
        return;
      }

      const newLectures = [];
      const invalidRows = [];
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cleanFields = parseCSVLine(line).map(f => f.replace(/^"|"$/g, '').trim());

        if (cleanFields.length < 13) {
          invalidRows.push({ lineNum: i + 1, reason: `열 개수가 부족합니다. (필요: 13개, 현재: ${cleanFields.length}개)` });
          continue;
        }

        const inst = cleanFields[0];
        const roleStr = cleanFields[1];
        const rateStr = cleanFields[2];
        const classesStr = cleanFields[3];
        const dateStr = cleanFields[10];

        if (!inst) {
          invalidRows.push({ lineNum: i + 1, reason: "기관명/학교가 비어 있습니다." });
          continue;
        }

        // Validate date format: YYYY-MM-DD
        if (!dateRegex.test(dateStr)) {
          invalidRows.push({ lineNum: i + 1, reason: `날짜 형식이 올바르지 않습니다. 반드시 'YYYY-MM-DD' 형식이어야 합니다. (입력값: "${dateStr}")` });
          continue;
        }

        // Validate numbers
        const rate = Number(rateStr);
        const classes = Number(classesStr);
        if (isNaN(rate) || isNaN(classes)) {
          invalidRows.push({ lineNum: i + 1, reason: `강의단가 또는 총 차시가 올바른 숫자가 아닙니다.` });
          continue;
        }

        const role = roleStr === '보조강사' ? 'Assistant' : 'Main';
        const expected = Number(cleanFields[4]) || 0;
        const transport = Number(cleanFields[5]) || 0;
        const taxRateVal = cleanFields[6]; // 공제율
        const deduction = Number(cleanFields[7]) || 0;
        const month = cleanFields[8] && cleanFields[8] !== 'undefined' ? cleanFields[8] : extractMonth(dateStr);
        const net = cleanFields[9] ? Number(cleanFields[9]) : 0;
        const date = dateStr;
        const regDate = cleanFields[11] && dateRegex.test(cleanFields[11]) ? cleanFields[11] : '';
        const isPaid = cleanFields[12] === '정산완료' || net > 0;

        let parsedTaxRate = '3.3%';
        if (taxRateVal) {
          const rawTaxVal = taxRateVal.replace('%', '').trim();
          if (rawTaxVal === '0' || rawTaxVal.toLowerCase() === 'none') {
            parsedTaxRate = 'None';
          } else {
            parsedTaxRate = rawTaxVal + '%';
          }
        } else {
          if (deduction !== 0 && expected > 0) {
            const ratio = Math.abs(deduction) / expected;
            if (Math.abs(ratio - 0.033) < 0.01) {
              parsedTaxRate = '3.3%';
            } else if (Math.abs(ratio - 0.088) < 0.015) {
              parsedTaxRate = '8.8%';
            } else {
              parsedTaxRate = (ratio * 100).toFixed(1) + '%';
            }
          } else if (deduction !== 0) {
            parsedTaxRate = '3.3%';
          } else {
            parsedTaxRate = 'None';
          }
        }

        newLectures.push({
          id: `csv-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          institution: inst,
          role,
          rate,
          classes,
          expectedAmount: expected,
          transportFee: transport,
          deduction,
          netAmount: net,
          month,
          date,
          registrationDate: regDate,
          isPaid,
          taxRate: parsedTaxRate,
          taxBase: 'LectureOnly',
          customTax: Math.abs(deduction)
        });
      }

      if (invalidRows.length > 0) {
        let errMsg = "CSV 파일 파싱 중 오류가 발생하여 가져오기를 취소했습니다.\n\n[오류 목록]\n";
        invalidRows.slice(0, 5).forEach(err => {
          errMsg += `- ${err.lineNum}번째 줄: ${err.reason}\n`;
        });
        if (invalidRows.length > 5) {
          errMsg += `...외 ${invalidRows.length - 5}건의 오류가 더 존재합니다.\n`;
        }
        errMsg += "\n💡 작성 표준 양식 CSV를 다운로드하여 형식을 다시 한 번 확인해 주세요. 날짜는 반드시 'YYYY-MM-DD' 형식(예: 2026-06-30)이어야 합니다.";
        alert(errMsg);
        return;
      }

      if (newLectures.length > 0) {
        if (window.confirm(`CSV 파일에서 ${newLectures.length}개의 출강 이력을 가져옵니다. 병합하시겠습니까?`)) {
          setLectures(prev => [...newLectures, ...prev]);
        }
      }
    };

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      // 한글이 깨질 때 발생하는 유니코드 대체 문자(\uFFFD) 감지 시 EUC-KR로 재디코딩
      if (text.includes('\uFFFD')) {
        const reReader = new FileReader();
        reReader.onload = (reEvent) => {
          processCsvText(reEvent.target.result);
        };
        reReader.readAsText(file, 'EUC-KR');
      } else {
        processCsvText(text);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // 업로드 시뮬레이션용 애니메이션 함수
  const handleAnimatedUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 12) + 6;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          handleImportCSV(file);
        }, 450);
      }
      setUploadProgress(progress);
    }, 40);
  };


  // statsYear 기준으로 lectures 필터링 (홈 탭 및 통계용)
  const homeYearLectures = useMemo(() => {
    return lectures.filter(l => getLectureYear(l) === statsYear);
  }, [lectures, statsYear]);

  // 홈 화면 요약 위젯 계산을 위한 필터링 (선택된 연도/월 및 기관 기준)
  const homeSummaryLectures = useMemo(() => {
    return lectures.filter(l => {
      if (!l) return false;
      if (selectedMonth === 'All') {
        if (getLectureYear(l) !== statsYear) return false;
      } else {
        if (extractMonth(l.date) !== selectedMonth) return false;
      }
      return selectedInstitution === 'All' || l.institution === selectedInstitution;
    });
  }, [lectures, statsYear, selectedMonth, selectedInstitution]);

  // 통계 계산
  const totalExpected = homeSummaryLectures.reduce((acc, curr) => acc + curr.expectedAmount, 0);
  const totalNet = homeSummaryLectures.reduce((acc, curr) => acc + (curr.isPaid ? curr.netAmount : 0), 0);
  const totalUnpaid = homeSummaryLectures.reduce((acc, curr) => acc + (curr.isPaid ? 0 : curr.expectedAmount), 0);
  const unpaidCount = homeSummaryLectures.filter(l => !l.isPaid).length;

  // 차트 집계
  const chartData = uniqueMonths.map(m => {
    const monthItems = homeYearLectures.filter(l => extractMonth(l.date) === m);
    const paidTotal = monthItems.reduce((acc, curr) => acc + (curr.isPaid ? curr.netAmount : 0), 0);
    const unpaidTotal = monthItems.reduce((acc, curr) => acc + (curr.isPaid ? 0 : curr.expectedAmount), 0);
    const hoursTotal = monthItems.reduce((acc, curr) => acc + (Number(curr.classes) || 0), 0);
    return {
      month: m,
      paid: paidTotal,
      unpaid: unpaidTotal,
      total: paidTotal + unpaidTotal,
      hours: hoursTotal
    };
  });

  const maxChartValue = Math.max(...chartData.map(d => d.total), 100000);

  // 연도 네비게이션 공통 계산 (TDZ 방지용 호이스팅)
  const _thisYearNow = new Date().getFullYear();
  const homeCanGoPrev = statsYear > (_thisYearNow - 3);
  const homeCanGoNext = statsYear < _thisYearNow;

  // --- Stats tab hoisted vars (TDZ fix) ---
  const _sNow = new Date().getFullYear();
  const statsCanGoPrev = statsYear > (_sNow - 3);
  const statsCanGoNext = statsYear < _sNow;
  const statsYearLectures = lectures.filter(l => getLectureYear(l) === statsYear);
  const statsYearUniqueMonths = Array.from(new Set(statsYearLectures.map(l => l.month))).sort((a, b) => {
    const matchA = a.match(/(\d+)월$/);
    const matchB = b.match(/(\d+)월$/);
    const numA = matchA ? parseInt(matchA[1], 10) : 0;
    const numB = matchB ? parseInt(matchB[1], 10) : 0;
    return numA - numB;
  });
  const statsMostFreqInst = (() => {
    if (statsYearLectures.length === 0) return '없음';
    const _c = {};
    statsYearLectures.forEach(l => { if (l.institution) _c[l.institution] = (_c[l.institution] || 0) + 1; });
    return Object.entries(_c).reduce((b, [k, v]) => v > b[1] ? [k, v] : b, ['없음', 0])[0];
  })();
  const _sFYM = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const statsFullYearData = _sFYM.map(m => {
    const monthNum = parseInt(m, 10);
    const _it = statsYearLectures.filter(l => {
      const monthStr = extractMonth(l.date);
      const match = monthStr.match(/(\d+)월$/);
      return match && parseInt(match[1], 10) === monthNum;
    });
    const _p = _it.reduce((s, l) => s + (l.isPaid ? l.netAmount : 0), 0);
    const _u = _it.reduce((s, l) => s + (l.isPaid ? 0 : l.expectedAmount), 0);
    return { month: m, total: _p + _u };
  });
  const _sMax = Math.max(...statsFullYearData.map(d => d.total), 1);
  const _sSW = 560; const _sSLP = 28; const _sSCW = _sSW - _sSLP - 28;
  const statsChartPoints = statsFullYearData.map((d, i) => ({
    x: _sSLP + i * (_sSCW / 11),
    y: 148 - (_sMax > 0 ? (d.total / _sMax) * 108 : 0)
  }));
  const statsPathD = statsChartPoints.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`).join(' ');
  const statsAreaD = statsPathD + ` L ${statsChartPoints[11].x} 148 L ${statsChartPoints[0].x} 148 Z`;

  // activeYearMonths 계산
  const activeYearMonths = (() => {
    const monthsWithData = new Set(
      lectures
        .filter(l => getLectureYear(l) === statsYear)
        .map(l => extractMonth(l.date))
    );
    const order = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const filtered = order.filter(m => monthsWithData.has(m));
    return filtered.length > 0 ? filtered : order;
  })();

  // 평균 소득 계산 및 Y 좌표 매핑
  const statsAverageIncome = (() => {
    const activeMonths = statsFullYearData.filter(d => d.total > 0);
    if (activeMonths.length === 0) return 0;
    const sum = activeMonths.reduce((acc, d) => acc + d.total, 0);
    return Math.round(sum / activeMonths.length);
  })();
  const averageY = 148 - (_sMax > 0 ? (statsAverageIncome / _sMax) * 108 : 0);

  // 최고 실적 월 지표 계산 (0-indexed)
  const peakMonthIndex = (() => {
    let maxVal = -1;
    let maxIdx = -1;
    statsFullYearData.forEach((d, idx) => {
      if (d.total > maxVal) {
        maxVal = d.total;
        maxIdx = idx;
      }
    });
    return maxVal > 0 ? maxIdx : -1;
  })();

  // YoY / MoM 증감율 계산
  const momBadges = (() => {
    if (selectedMonth === 'All') {
      const curYearTotal = lectures
        .filter(l => getLectureYear(l) === statsYear)
        .reduce((sum, l) => sum + (l.netAmount || 0), 0);

      const prevYearTotal = lectures
        .filter(l => getLectureYear(l) === statsYear - 1)
        .reduce((sum, l) => sum + (l.netAmount || 0), 0);

      if (prevYearTotal === 0) return { type: 'YoY', pct: null };
      const pct = ((curYearTotal - prevYearTotal) / prevYearTotal) * 100;
      return { type: 'YoY', pct: Math.round(pct) };
    } else {
      const monthNum = parseInt(selectedMonth, 10);
      const curMonthTotal = lectures
        .filter(l => getLectureYear(l) === statsYear && extractMonth(l.date) === selectedMonth)
        .reduce((sum, l) => sum + (l.netAmount || 0), 0);

      const prevMonthName = monthNum === 1 ? '12월' : `${monthNum - 1}월`;
      const prevYearTarget = monthNum === 1 ? statsYear - 1 : statsYear;
      const prevMonthTotal = lectures
        .filter(l => getLectureYear(l) === prevYearTarget && extractMonth(l.date) === prevMonthName)
        .reduce((sum, l) => sum + (l.netAmount || 0), 0);

      if (prevMonthTotal === 0) return { type: 'MoM', pct: null };
      const pct = ((curMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
      return { type: 'MoM', pct: Math.round(pct) };
    }
  })();

  const _sIM = {}; let _sOT = 0;
  statsYearLectures.forEach(l => { const a = l.expectedAmount || 0; _sIM[l.institution] = (_sIM[l.institution] || 0) + a; _sOT += a; });
  const statsSortedInsts = Object.entries(_sIM).map(([n, v]) => ({ name: n, val: v, pct: _sOT > 0 ? (v / _sOT) * 100 : 0 })).sort((a, b) => b.val - a.val).slice(0, 5);
  const filteredLectures = lectures.filter(l => {
    if (!l) return false;
    
    // 1. Year/Month Filter: If selectedMonth is 'All', only show lectures of statsYear.
    // Otherwise, show matching month regardless of statsYear (implicit year match).
    if (selectedMonth === 'All') {
      if (getLectureYear(l) !== statsYear) return false;
    } else {
      if (extractMonth(l.date) !== selectedMonth) return false;
    }

    const matchesInst = selectedInstitution === 'All' || l.institution === selectedInstitution;
    const matchesStatus = 
      selectedStatus === 'All' || 
      (selectedStatus === 'Paid' && l.isPaid) || 
      (selectedStatus === 'Pending' && !l.isPaid);
    
    return matchesInst && matchesStatus;
  }).sort((a, b) => {
    // 1. 대기(Pending)가 완료(Paid)보다 상단에 위치하도록 정렬
    if (a.isPaid !== b.isPaid) {
      return a.isPaid ? 1 : -1;
    }
    // 2. 최신 등록 순 정렬 (ID 내림차순)
    return b.id.localeCompare(a.id);
  });

  const listItems = (() => {
    const items = [...filteredLectures];
    if (deletedLecture && deletedLectureIndex >= 0 && deletedLectureIndex <= items.length) {
      items.splice(deletedLectureIndex, 0, { isUndoPlaceholder: true, data: deletedLecture });
    }
    return items;
  })();

  const gasTemplateCode = `function doGet(e) {
  // 연동된 스프레드시트 열기 요청 처리
  if (e && e.parameter && e.parameter.open === "true") {
    var url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
    return HtmlService.createHtmlOutput("<meta http-equiv='refresh' content='0; url=" + url + "'><script>window.location.href = '" + url + "';</script><div style='font-family:sans-serif; text-align:center; padding:30px;'><h3 style='color:#1E3A8A;'>출강바이브 연동 스프레드시트</h3><p style='color:#475569;'>구글 스프레드시트로 이동 중입니다...</p></div>");
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  // 만약 빈 시트이거나 행이 전혀 없는 경우 초기화
  if (data.length <= 1 || (data.length === 2 && !data[1][0])) {
    var headers = ['기관명/학교', '출강역할', '강의단가', '총 차시', '예상수령액', '교통비(+)', '공제율(%)', '공제금액(-)', '월', '실수령액', '날짜', '등록일', '정산여부', 'ID'];
    sheet.clearContents();
    sheet.appendRow(headers);
    data = [headers];
  }
  
  var headers = data[0];
  var colMap = {};
  for (var k = 0; k < headers.length; k++) {
    colMap[String(headers[k]).trim()] = k;
  }
  
  function getVal(row, headerName, def) {
    var idx = colMap[headerName];
    if (idx === undefined || idx >= row.length) return def;
    return row[idx];
  }

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var rowData = data[i];
    if (rowData.length === 0 || (!rowData[0] && rowData.length <= 1)) continue;
    
    var item = {};
    
    item.institution = getVal(rowData, '기관명/학교', "") || "";
    var roleStr = getVal(rowData, '출강역할', "주강사") || "주강사";
    item.role = roleStr === "보조강사" ? "Assistant" : "Main";
    item.rate = Number(getVal(rowData, '강의단가', 0)) || 0;
    item.classes = Number(getVal(rowData, '총 차시', 0)) || 0;
    item.expectedAmount = Number(getVal(rowData, '예상수령액', 0)) || 0;
    item.transportFee = Number(getVal(rowData, '교통비(+)', 0)) || 0;
    
    var taxRateVal = String(getVal(rowData, '공제율(%)', "3.3") || "3.3").trim();
    item.taxRate = (taxRateVal === "0" || taxRateVal.toLowerCase() === "none") ? "None" : (taxRateVal.indexOf("%") !== -1 ? taxRateVal : taxRateVal + "%");
    
    item.deduction = Number(getVal(rowData, '공제금액(-)', 0)) || 0;
    item.month = String(getVal(rowData, '월', "") || "");
    item.netAmount = Number(getVal(rowData, '실수령액', 0)) || 0;
    
    var dateVal = getVal(rowData, '날짜', "");
    if (dateVal instanceof Date) {
      dateVal = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    item.date = String(dateVal || "");
    
    var regDateVal = getVal(rowData, '등록일', "");
    if (regDateVal instanceof Date) {
      regDateVal = Utilities.formatDate(regDateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    item.registrationDate = String(regDateVal || "");
    
    var isPaidStr = getVal(rowData, '정산여부', "정산대기") || "정산대기";
    item.isPaid = (isPaidStr === "정산완료");
    
    item.id = String(getVal(rowData, 'ID', "") || "gs-" + Date.now() + "-" + i);
    
    // Additional internal fields
    item.taxBase = "LectureOnly";
    item.customTax = Math.abs(item.deduction);
    
    rows.push(item);
  }
  var responsePayload = {
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    lectures: rows
  };
  return ContentService.createTextOutput(JSON.stringify(responsePayload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var payload = JSON.parse(e.postData.contents);
  var action = payload.action;
  
  if (action === "sync_all") {
    sheet.clearContents();
    var headers = ['기관명/학교', '출강역할', '강의단가', '총 차시', '예상수령액', '교통비(+)', '공제율(%)', '공제금액(-)', '월', '실수령액', '날짜', '등록일', '정산여부', 'ID'];
    sheet.appendRow(headers);
    
    if (payload.lectures && payload.lectures.length > 0) {
      payload.lectures.forEach(function(l) {
        var roleKorean = l.role === 'Assistant' ? '보조강사' : '주강사';
        var taxRateNum = l.taxRate === 'None' ? '0' : (l.taxRate || '3.3').replace('%', '');
        var isPaidKorean = l.isPaid ? '정산완료' : '정산대기';
        
        sheet.appendRow([
          l.institution,
          roleKorean,
          Number(l.rate) || 0,
          Number(l.classes) || 0,
          Number(l.expectedAmount) || 0,
          Number(l.transportFee) || 0,
          taxRateNum,
          Number(l.deduction) || 0,
          l.month,
          l.isPaid ? Number(l.netAmount) : "",
          l.date,
          l.registrationDate || "",
          isPaidKorean,
          l.id
        ]);
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", count: payload.lectures.length }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-0 md:p-4 text-[#1F2E5B] font-sans antialiased" style={{fontFamily: "'Pretendard', 'Inter', sans-serif"}}>
      <svg className="absolute w-0 h-0" width="0" height="0">
        <defs>
          <pattern id="unpaid-stripes" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <rect width="6" height="12" fill="rgba(31, 46, 91, 0.08)" />
            <rect x="6" width="6" height="12" fill="rgba(31, 46, 91, 0.22)" />
          </pattern>
        </defs>
      </svg>

      {/* Main centered mobile-frame container on desktop, full screen on mobile */}
      <div className="w-full max-w-md bg-[#F8FAF8] min-h-screen md:min-h-[88vh] md:max-h-[94vh] md:rounded-[36px] shadow-2xl relative overflow-hidden flex flex-col pb-0 md:border md:border-slate-800/10">
        
        

        <div className="flex-1 flex flex-col min-h-0">
        {/* App Title Header — Clean White Theme */}
        <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              {/* 3D Coin Lottie Logo */}
              <StableLottie path="/lottie/Fake 3D vector coin.json" className="w-[34px] h-[34px] drop-shadow-sm flex-shrink-0" />
              <div>
                <h1 className="text-[#0F172A] text-[18px] font-black tracking-tight" style={{lineHeight: 1.15}}>
                  출강바이브
                </h1>
                {sheetUrl && (
                  <button
                    onClick={fetchFromGoogleSheet}
                    type="button"
                    className="text-[9.5px] font-extrabold text-slate-400 block -mt-0.5 border-none bg-transparent p-0 cursor-pointer hover:opacity-85 active:scale-95 transition"
                    title="클릭하여 구글 시트에서 최신 데이터 가져오기"
                  >
                    {isSyncing || syncLoading ? (
                      <span className="text-[#2563EB] animate-pulse flex items-center gap-0.5">
                        <RefreshCw size={8} className="animate-spin" /> 동기화 중...
                      </span>
                    ) : (
                      <span className="text-emerald-500 flex items-center gap-0.5 bg-emerald-50 border border-emerald-100/60 px-1 py-0.5 rounded-md hover:bg-emerald-100/70 transition-colors">
                        ☁️ 실시간 동기 완료 <RefreshCw size={6.5} className="text-emerald-400 ml-0.5" />
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Gemini AI pill Button */}
              <button 
                onClick={() => {
                  setAiText('');
                  setAiError(null);
                  setParsedLectures([]);
                  setIsAiVerifying(false);
                  setIsAiModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border border-transparent rounded-full transition shadow-md shadow-blue-500/10 active:scale-95 flex-shrink-0 animate-pulse-glow"
                title="AI 일정 등록"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[14px] h-[14px] drop-shadow-sm">
                  <defs>
                    <linearGradient id="gemini-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="100%" stopColor="#E0E7FF" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2C12 2 12.3 8.5 4 12C12.3 12 12 22 12 22C12 22 11.7 12 20 12C11.7 8.5 12 2 12 2Z" fill="url(#gemini-logo-grad)" />
                </svg>
                <span className="text-[11.5px] font-black text-white tracking-tight">AI 일정 등록</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Tab Body — motion: slide direction from prevTab */}
        <div id="tab-body-container" className="p-3 flex-1 flex flex-col gap-3 overflow-y-auto pb-28">
          {/* invisible motion key — forces re-mount on tab change for animation */}
          
          {/* TAB 1: HOME (Lectures Card List) */}
          {activeTab === 'home' && (
            <div key="tab-home" className={`${getSlideClass()} flex flex-col gap-3 pt-2`}>
              
              {/* 연도 조작 셀렉터 - 심플 가로 중앙 정렬 */}
              <div className="flex items-center justify-center gap-4 py-1.5 animate-fade-in">
                {homeCanGoPrev ? (
                  <button onClick={() => setStatsYear(y => y - 1)}
                    className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                    aria-label="이전 연도">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                ) : <span className="w-8 h-8"/>}
                {statsYear === 2026 ? (
                  <span className="glossy-year-badge px-3.5 py-1.5 rounded-full text-[13px] font-black text-slate-850 tracking-tight flex items-center gap-1.5 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00BCD4] animate-pulse" />
                    {statsYear}년
                  </span>
                ) : (
                  <span className="text-[15.5px] font-black text-slate-800 tracking-tight">{statsYear}년</span>
                )}
                {homeCanGoNext ? (
                  <button onClick={() => setStatsYear(y => y + 1)}
                    className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                    aria-label="다음 연도">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                ) : <span className="w-8 h-8"/>}
              </div>

              {/* 모바일 2분할 슬림 요약 위젯 */}
              <div className="grid grid-cols-2 gap-3 animate-fade-in">
                {/* 대기 위젯 */}
                <div 
                  className="rounded-[20px] p-4 bg-white border border-slate-200/60 flex flex-col gap-1 shadow-sm relative overflow-hidden"
                >
                  
                  <span className="text-[12px] font-black text-slate-400">정산 대기</span>
                  <span className="text-lg font-black text-slate-800 tracking-tight">
                    <AnimatedNumber value={totalUnpaid} />
                  </span>
                  <div className="text-[11px] text-slate-500 font-bold mt-0.5">
                    총 {unpaidCount}건 대기 중
                  </div>
                </div>

                {/* 완료 위젯 */}
                <div 
                  className="rounded-[20px] p-4 bg-white border border-slate-200/60 flex flex-col gap-1 shadow-sm relative overflow-hidden"
                >
                  
                  <span className="text-[12px] font-black text-slate-400">정산 완료</span>
                  <span className="text-lg font-black text-emerald-600 tracking-tight">
                    <AnimatedNumber value={totalNet} />
                  </span>
                  <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
                    총 {lectures.filter(l=>l.isPaid).length}건 완료
                  </div>
                </div>
              </div>



              {/* Filters Box */}

              <div className="bg-white p-3 rounded-[20px] border border-toss-border shadow-sm flex flex-col gap-2">
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-500 font-black text-xs pointer-events-none">🏢</span>
                  <select
                    value={selectedInstitution}
                    onChange={(e) => setSelectedInstitution(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 border border-toss-border rounded-xl text-[12.5px] font-black bg-[#F8FAF8] text-slate-800 focus:outline-none focus:border-[#2563EB] appearance-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 4.5 6 7.5 9 4.5'/></svg>")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                    }}
                  >
                    <option value="All">전체 교육기관 선택</option>
                    {uniqueInstitutions.map(inst => (
                      <option key={inst} value={inst}>{inst}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 items-center justify-between border-t border-slate-100 pt-2.5">
                  {/* Left Side: Month selection (5:5 layout) */}
                  <div className="w-[49%] flex gap-1 py-1 flex-shrink-0">
                    <button 
                      onClick={() => setSelectedMonth('All')}
                      className={`flex-1 text-[10px] font-black py-1.5 rounded-lg text-center transition-all ${selectedMonth === 'All' ? 'bg-[#1F2E5B] text-white' : 'bg-gray-100 text-slate-500 hover:bg-slate-200/50'}`}
                    >
                      전체
                    </button>
                    <button 
                      onClick={() => setIsMonthPickerOpen(true)}
                      className={`flex-1 text-[10px] font-black py-1.5 rounded-lg text-center transition-all ${selectedMonth !== 'All' ? 'bg-[#1F2E5B] text-white' : 'bg-gray-100 text-slate-500 hover:bg-slate-200/50'}`}
                    >
                      {selectedMonth === 'All' ? '월 선택 ▾' : `${selectedMonth} ▾`}
                    </button>
                  </div>
                  
                  {/* Separator line */}
                  <div className="w-[1px] h-6 bg-slate-200 flex-shrink-0" />
                  
                  {/* Right Side: Status list (grid, no-scroll) */}
                  <div className="w-[49%] grid grid-cols-3 gap-1 py-1 flex-shrink-0">
                    <button 
                      onClick={() => setSelectedStatus('All')}
                      className={`text-[10px] font-black py-1.5 rounded-lg text-center ${selectedStatus === 'All' ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-slate-500'}`}
                    >
                      전체
                    </button>
                    <button 
                      onClick={() => setSelectedStatus('Paid')}
                      className={`text-[10px] font-black py-1.5 rounded-lg text-center ${selectedStatus === 'Paid' ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-slate-500'}`}
                    >
                      완료
                    </button>
                    <button 
                      onClick={() => setSelectedStatus('Pending')}
                      className={`text-[10px] font-black py-1.5 rounded-lg text-center ${selectedStatus === 'Pending' ? 'bg-[#F59E0B] text-white' : 'bg-gray-100 text-slate-500'}`}
                    >
                      대기
                    </button>
                  </div>
                </div>
              </div>

              {/* Card List */}
              {listItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <Calendar size={36} className="text-toss-textSub mb-2" />
                  <span className="text-xs font-bold text-toss-textDark">기록된 출강 건이 없습니다.</span>
                  <p className="text-[10px] text-toss-textSub mt-1">상단의 + 단추나 AI 스캔 단추를 눌러 시작해 보세요.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {listItems.map((l, idx) => {
                    if (l.isUndoPlaceholder) {
                      return (
                        <div 
                          key={`undo-${l.data.id}`}
                          className="bg-red-50/50 border border-dashed border-red-200 rounded-[22px] p-4 flex flex-col gap-2.5 shadow-sm animate-fade-in relative overflow-hidden"
                        >
                          <div className="flex justify-between items-center">
                            <div className="min-w-0 flex-1 pr-2">
                              <span className="text-[12px] font-black text-red-600 flex items-center gap-1">
                                🗑️ 출강 기록이 삭제되었습니다
                              </span>
                              <span className="text-[10.5px] text-slate-500 font-extrabold truncate block mt-0.5">
                                {l.data.institution} · {formatWon(l.data.expectedAmount)}원
                              </span>
                            </div>
                            <button 
                              onClick={handleUndoDelete}
                              className="px-3.5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-black text-[11px] rounded-xl transition shadow-sm active:scale-95 flex items-center gap-1.5 flex-shrink-0 border-none cursor-pointer"
                            >
                              <span>되돌리기</span>
                              <span className="inline-block bg-white/20 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold min-w-[18px] text-center">
                                {Math.max(1, Math.ceil(undoProgress / 14.3))}초
                              </span>
                            </button>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full h-1 bg-red-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-red-500 transition-all ease-linear duration-100"
                              style={{ width: `${undoProgress}%` }}
                            />
                          </div>
                        </div>
                      );
                    }

                    const isRecentlyPaid = recentlyPaidCardId === l.id;
                    return (
                      <div
                        key={l.id}
                        ref={isRecentlyPaid ? recentlyPaidCardRef : null}
                        className={`card-hover relative bg-white rounded-[22px] flex flex-col ${isRecentlyPaid ? 'animate-emerald-glow' : ''}`}
                        style={{
                          border: l.isPaid ? '1.5px solid rgba(16,185,129,0.35)' : '1.5px solid rgba(245,158,11,0.35)',
                          boxShadow: l.isPaid ? '0 4px 14px rgba(16,185,129,0.06)' : '0 4px 14px rgba(245,158,11,0.06)',
                          zIndex: activeMenuCardId === l.id ? 30 : 1,
                          animationDelay: (idx * 55) + 'ms',
                          padding: '18px'
                        }}
                      >
                          <div className="flex items-start justify-between mb-2 gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[13px] font-black px-3 py-1 rounded-lg inline-block flex-shrink-0" style={{background:'rgba(30,58,138,0.07)',color:'#1E3A8A'}}>{l.date || '날짜 미지정'}</span>
                                {l.role === 'Assistant' && <span className="text-[11px] font-black text-slate-400 border border-slate-200 px-1.5 rounded flex-shrink-0">보조</span>}
                              </div>
                              <h3 className="text-[17.5px] font-black text-[#0F172A] leading-tight tracking-tight relative z-10 break-all">{l.institution}</h3>
                            </div>
                            <div className="flex items-center gap-2 relative z-10 flex-shrink-0">
                              <button onClick={() => handleTogglePaid(l)} className="btn-press text-[13px] font-black px-3.5 py-1.5 rounded-xl transition flex-shrink-0 whitespace-nowrap" style={l.isPaid?{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)',color:'#10B981'}:{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',color:'#F59E0B'}}>
                                {l.isPaid ? '✓ 완료' : '대기'}
                              </button>
                              <div className="relative">
                                <button onClick={(e) => {e.stopPropagation();setActiveMenuCardId(activeMenuCardId===l.id?null:l.id);}} className="btn-press p-2 rounded-xl hover:bg-slate-100 transition">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                </button>
                                {activeMenuCardId === l.id && (
                                  <div className="absolute right-0 bottom-full mb-2 bg-white border border-slate-200 shadow-xl rounded-xl z-20 py-1.5 px-1.5 flex flex-col gap-1 w-32">
                                    <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         if (l.isPaid) {
                                           setEditingNetCardId(l.id);
                                           setEditingNetValue(String(l.netAmount));
                                           setIsNetEditModalOpen(true);
                                         } else {
                                           handleEditClick(l);
                                         }
                                         setActiveMenuCardId(null);
                                       }} 
                                       className="w-full text-left py-2.5 px-3 text-[13px] font-bold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                                     >
                                       <Edit3 size={14} className="text-slate-400" />
                                       {l.isPaid ? '금액 수정' : '수정하기'}
                                     </button>
                                    <button onClick={(e) => {e.stopPropagation();handleDelete(l.id);setActiveMenuCardId(null);}} className="w-full text-left py-2.5 px-3 text-[13px] font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"><Trash2 size={14} className="text-red-400" />삭제하기</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {l.isPaid && (
                            <div className="grid grid-cols-[53%_47%] gap-y-1.5 text-[14px] text-slate-500 py-3 border-t border-dashed border-slate-200 relative z-10 animate-fade-in">
                              <div className="flex flex-col justify-center gap-1.5 text-[12.5px]">
                                <div className="flex items-center">
                                  <span className="font-bold w-12 text-slate-400">단가</span>
                                  <span className="font-extrabold text-slate-800">{formatWon(l.rate)}원</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-bold w-12 text-slate-400">시간</span>
                                  <span className="font-extrabold text-slate-800">{l.classes}h</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-bold w-12 text-slate-400">교통비</span>
                                  <span className="font-extrabold text-slate-800">{formatWon(l.transportFee)}원</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end justify-center pl-4 border-l border-slate-200">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                  <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-extrabold">{l.taxRate || '3.3%'} 공제</span>
                                  <span className="line-through">{formatWon(l.expectedAmount)}원</span>
                                </div>
                                <AnimatedNumber 
                                  value={l.netAmount} 
                                  className="font-black text-[#10B981] text-[17px] mt-1" 
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
          {/* TAB 1.5: CALENDAR */}
          {activeTab === 'calendar' && (
            <div 
              key="tab-calendar" 
              className={`${getSlideClass()} flex flex-col gap-3 select-none pt-2`}
              onTouchStart={handleCalTouchStart}
              onTouchEnd={handleCalTouchEnd}
            >
              <div className="bg-white p-4 pb-5 rounded-[24px] border border-slate-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition active:scale-95 text-slate-500 font-bold"
                    >
                      &lt;
                    </button>
                    <h3 className="text-[16px] font-black text-slate-800 flex items-center gap-1.5 w-32 justify-center">
                      {currentYear}년 {currentMonth + 1}월
                    </h3>
                    <button 
                      type="button"
                      onClick={handleNextMonth}
                      className="p-2 rounded-lg hover:bg-slate-100 transition active:scale-95 text-slate-500 font-black text-base"
                    >
                      &gt;
                    </button>
                  </div>
                  
                  {new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear ? (
                    <span className="text-[11px] text-[#2563EB] font-black bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                      이번 달
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCalDate(new Date())}
                      className="text-[11px] text-slate-500 hover:text-slate-700 font-black bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full transition"
                    >
                      오늘로
                    </button>
                  )}
                </div>
                
                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 gap-x-1 text-center border-b border-slate-100 pb-2.5 mb-3 text-[12px] font-black text-[#94A3B8]">
                  {['일','월','화','수','목','금','토'].map((d, idx) => (
                    <span key={d} className={idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : ''}>{d}</span>
                  ))}
                </div>
                
                {/* 날짜 그리드 - 슬라이드 효과 적용 */}
                <div className={`grid grid-cols-7 gap-y-4 gap-x-2 text-center text-xs transition-all duration-300 ${
                  calTransition === 'slide-left' ? 'translate-x-[-12px] opacity-0' :
                  calTransition === 'slide-right' ? 'translate-x-[12px] opacity-0' : 'translate-x-0 opacity-100'
                }`}>
                  {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                    <span key={`empty-${idx}`} />
                  ))}
                  
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${currentMonth + 1}월 ${day}일`;
                    
                    const dayLectures = lectures.filter(l => matchesCalendarDate(l.date, dateStr));
                    const hasPaid = dayLectures.some(l => l.isPaid);
                    const hasUnpaid = dayLectures.some(l => !l.isPaid);
                    
                    // 30일 경고
                    const hasWarning = dayLectures.some(l => {
                      if (l.isPaid) return false;
                      const regDate = new Date(l.registrationDate);
                      const diffTime = Math.abs(new Date() - regDate);
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return diffDays >= 30;
                    });
 
                    const hasLectures = dayLectures.length > 0;
                    const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
 
                    return (
                      <div 
                        key={day} 
                        onClick={() => {
                          if (hasLectures) {
                            setSelectedCalendarDate(dateStr);
                          }
                        }}
                        className={`flex flex-col items-center justify-center relative py-2 rounded-xl transition-all ${
                          hasLectures 
                            ? 'cursor-pointer bg-slate-50 hover:bg-blue-50/60 border border-slate-200/60' 
                            : 'text-slate-400'
                        } ${isToday ? 'ring-2 ring-[#1E3A8A]/30 bg-blue-50/20' : ''}`}
                      >
                        <span className={`text-[13px] font-black ${
                          isKoreanHoliday(currentYear, currentMonth, day)
                            ? 'text-red-500'
                            : (isToday ? 'text-[#1E3A8A]' : (hasLectures ? 'text-[#0F172A]' : 'text-slate-500'))
                        } ${hasLectures ? 'text-[15px]' : ''}`}>
                          {day}
                        </span>
                        {/* 도트 */}
                        <div className="flex gap-0.5 justify-center mt-0.5 h-1">
                          {hasPaid && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: `${(day % 5) * 0.3}s`, animationDuration: '1.5s' }} />}
                          {hasUnpaid && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: `${(day % 5) * 0.3}s`, animationDuration: '1.5s' }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 달력 안내 안내카드 */}
              <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-[16px] text-[13.5px] text-slate-700 leading-normal flex flex-col gap-1.5 mt-0 shadow-sm">
                <span className="font-extrabold text-[14.5px] text-slate-800 flex items-center gap-1">💡 캘린더 안내</span>
                <p className="font-semibold text-slate-600">기록일은 연하게 칠해지며, 해당 날짜 터치 시 하단에 상세 명세서가 바로 노출됩니다.</p>
                <div className="flex items-center gap-3 mt-1 font-bold text-[12px]">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDuration: '1.5s' }}/> 완료</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDuration: '1.5s' }}/> 대기</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div key="tab-stats" className={`${getSlideClass()} flex flex-col gap-3 pt-2`}>
              {/* 연도 조작 셀렉터 - 심플 가로 중앙 정렬 */}
              <div className="flex items-center justify-center gap-4 py-1.5 animate-fade-in">
                {statsCanGoPrev ? (
                  <button onClick={() => setStatsYear(y => y - 1)}
                    className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                    aria-label="이전 연도">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                ) : <span className="w-8 h-8"/>}
                {statsYear === 2026 ? (
                  <span className="glossy-year-badge px-3.5 py-1.5 rounded-full text-[13px] font-black text-slate-850 tracking-tight flex items-center gap-1.5 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00BCD4] animate-pulse" />
                    {statsYear}년
                  </span>
                ) : (
                  <span className="text-[15.5px] font-black text-slate-800 tracking-tight">{statsYear}년</span>
                )}
                {statsCanGoNext ? (
                    <button onClick={() => setStatsYear(y => y + 1)}
                      className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                      aria-label="다음 연도">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  ) : <span className="w-8 h-8"/>}
                </div>

                {/* 출강 성과 요약 */}
                <div className="bg-white p-5 rounded-[24px] shadow-sm animate-fade-in" style={{border: '1px solid rgba(31,46,91,0.10)'}}>
                  <span className="text-[15px] font-black block mb-4 text-slate-800">출강 성과 및 요약</span>
                  {statsYearLectures.length === 0 ? (
                    <div className="text-[12px] text-slate-400 text-center py-8 font-bold">집계할 출강 데이터가 없습니다.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-slate-400">총 출강 횟수</span>
                        <AnimatedNumber value={statsYearLectures.length} suffix="건" className="text-[18px] font-black text-slate-800" />
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-slate-400">총 출강 시간</span>
                        <AnimatedNumber value={statsYearLectures.reduce((sum, l) => sum + (l.classes || 0), 0)} suffix="시간" className="text-[18px] font-black text-indigo-600" />
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-slate-400">월별 출강 평균 횟수</span>
                        <AnimatedNumber value={Math.round(statsYearLectures.length / (statsYearUniqueMonths.length || 1))} suffix="건" className="text-[18px] font-black text-slate-800" />
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-0.5 min-w-0">
                        <span className="text-[11px] font-bold text-slate-400">최다 출강 교육기관</span>
                        <span className="text-[13.5px] font-black text-slate-800 truncate block mt-0.5" title={statsMostFreqInst}>
                          {statsMostFreqInst}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

              {/* 월별 수입 가로 추이 차트 (연도별, 1월~12월) */}
              {(
                  <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-sm flex flex-col gap-0 animate-fade-in overflow-hidden">
                    {/* 연도 네비게이션 헤더 */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[15px] font-black text-slate-800">월별 정산 추이</h4>
                        <span className="text-[11px] font-bold text-slate-400 ml-0.5">밀어서 보기</span>
                        {momBadges.pct !== null && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-0.5 ${
                            momBadges.pct >= 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                          }`}>
                            {momBadges.type} {momBadges.pct >= 0 ? `▲ ${momBadges.pct}%` : `▼ ${Math.abs(momBadges.pct)}%`}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-extrabold">(단위: 만원)</span>
                    </div>

                    {statsYearLectures.length === 0 ? (
                      <div className="text-[12px] text-slate-400 text-center py-10 font-bold px-5 pb-5">{statsYear}년 출강 데이터가 없습니다.</div>
                    ) : (
                      <div
                        ref={chartScrollRef}
                        className="w-full overflow-x-auto overflow-y-hidden scrollbar-none pb-4 px-0"
                        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
                      >
                        <div style={{ width: `${_sSW}px`, flexShrink: 0 }}>
                          <svg viewBox={`0 0 ${_sSW} 200`} width={_sSW} height="200" className="overflow-visible">
                            <defs>
                              {/* 라인 그라데이션: 인디고 → 블루 (프로젝트 디자인 톤) */}
                              <linearGradient id="chart-line-grad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#6366F1"/>
                                <stop offset="100%" stopColor="#3B82F6"/>
                              </linearGradient>
                              {/* 영역 채우기 그라데이션 */}
                              <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.18"/>
                                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.01"/>
                              </linearGradient>
                              {/* 글로우 필터 */}
                              <filter id="glow-indigo" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur"/>
                                <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                              </filter>
                            </defs>

                            {/* 수평 가이드라인 (3줄) */}
                            {[40, 80, 120].map(y => (
                              <line key={y} x1={_sSLP} y1={y} x2={_sSW - 28} y2={y}
                                stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4"/>
                            ))}

                            {/* X축 기준선 */}
                            <line x1={_sSLP} y1="148" x2={_sSW - 28} y2="148"
                              stroke="#CBD5E1" strokeWidth="1.5"/>

                            {/* 영역 채우기 */}
                            {statsAreaD && (
                              <path d={statsAreaD} fill="url(#chart-area-grad)" strokeWidth="0"/>
                            )}

                            {/* 평균 소득 가이드라인 점선 */}
                            {statsAverageIncome > 0 && (
                              <g>
                                <line 
                                  x1={_sSLP} 
                                  y1={averageY} 
                                  x2={_sSW - 28} 
                                  y2={averageY}
                                  stroke="#6366F1" 
                                  strokeWidth="1.5" 
                                  strokeDasharray="3 3"
                                  opacity="0.6"
                                />
                                <text 
                                  x={_sSW - 32} 
                                  y={averageY - 5} 
                                  fill="#4F46E5" 
                                  fontSize="8.5" 
                                  fontWeight="900" 
                                  textAnchor="end"
                                >
                                  평균: {(statsAverageIncome / 10000).toFixed(1).replace('.0', '')}만
                                </text>
                              </g>
                            )}

                            {/* 메인 라인 */}
                            {statsPathD && (
                              <path
                                d={statsPathD}
                                fill="none"
                                stroke="url(#chart-line-grad)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                filter="url(#glow-indigo)"
                                style={{
                                  strokeDasharray: 2000,
                                  strokeDashoffset: 2000,
                                  animation: 'drawHorizontalLine 2s cubic-bezier(0.4,0,0.2,1) forwards'
                                }}
                              />
                            )}

                            {/* 노드 + 월 라벨 + 금액 */}
                            {statsChartPoints.map((p, i) => {
                              const d = statsFullYearData[i];
                              const hasValue = d.total > 0;
                              
                              const isCurrentSelected = selectedMonth !== 'All' && selectedMonth === d.month;
                              const isTodayMonth = selectedMonth === 'All' && new Date().getMonth() === i && new Date().getFullYear() === statsYear;
                              const isHighlighted = isCurrentSelected || isTodayMonth;

                              return (
                                <g key={i}>
                                  {isHighlighted && (
                                    <circle cx={p.x} cy={p.y} r="12"
                                      fill="none"
                                      stroke="#3B82F6"
                                      strokeWidth="2.5"
                                      className="animate-pulse"
                                    />
                                  )}
                                  {hasValue && (
                                    <circle cx={p.x} cy={p.y} r="7"
                                      fill="rgba(99,102,241,0.15)"
                                      className="animate-pulse"/>
                                  )}
                                  <circle cx={p.x} cy={p.y}
                                    r={hasValue ? "4" : "2"}
                                    fill={hasValue ? "#fff" : "#CBD5E1"}
                                    stroke={hasValue ? "#6366F1" : "none"}
                                    strokeWidth={hasValue ? "2.5" : "0"}/>
                                  {/* 월 라벨 */}
                                  <text x={p.x} y="170" fill={isHighlighted ? "#1E3A8A" : "#94A3B8"}
                                    fontSize="11" fontWeight="800" textAnchor="middle">
                                    {d.month}
                                  </text>
                                  {/* 최고 실적 월 왕관 이모지 */}
                                  {hasValue && i === peakMonthIndex && (
                                    <text x={p.x} y={Math.max(p.y - 30, 14)} fontSize="12" textAnchor="middle">👑</text>
                                  )}
                                  {/* 금액 라벨 (노드 위) */}
                                  {hasValue && (
                                    <text x={p.x} y={Math.max(p.y - 15, 14)}
                                      fill="#1E3A8A"
                                      fontSize="10.5" fontWeight="900" textAnchor="middle">
                                      {d.total >= 10000 ? (d.total / 10000).toFixed(1).replace('.0', '') : d.total}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                        <style dangerouslySetInnerHTML={{__html: `
                          @keyframes drawHorizontalLine {
                            to { stroke-dashoffset: 0; }
                          }
                        `}}/>
                      </div>
                    )}
                  </div>
              )}


              {/* 주관사(기관)별 출강 비중 */}
              <div className="bg-white p-5 rounded-[24px] border border-slate-200/60 shadow-sm flex flex-col gap-3">
                <div>
                  <h4 className="text-[15px] font-black text-slate-800">어느 기관에서 가장 수입이 많았을까요?</h4>
                  <p className="text-[11.5px] text-slate-400 mt-0.5 font-semibold">기관별 수입 기여도 순위</p>
                </div>
                {statsYearLectures.length === 0 ? (
                  <div className="text-[12px] text-slate-400 text-center py-10 font-bold">데이터가 없습니다.</div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {statsSortedInsts.map((inst, i) => {
                      return (
                        <div key={i} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[12px] font-bold">
                            <span 
                              className="text-slate-700 truncate max-w-[200px] cursor-help" 
                              title={inst.name}
                            >
                              {inst.name}
                            </span>
                            <span className="text-slate-500 flex-shrink-0">
                              {Math.round(inst.pct)}% ({formatWon(inst.val)}원)
                            </span>
                          </div>
                          {/* 가로 프로그레스 바 비중 시각화 */}
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-[#2563EB] rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${inst.pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}



          {/* TAB 4: SETTINGS (merged with Sync) */}
          {activeTab === 'settings' && (
            <div key="tab-settings" className={`${getSlideClass()} flex flex-col gap-4 pt-2`}>
              
              {/* Local Export/Import Accordion - Moved to Top */}
              <div className="rounded-[24px] bg-emerald-50/10 border border-emerald-200 overflow-hidden shadow-sm transition-all">
                <button
                  type="button"
                  onClick={() => setIsLocalBackupOpen(!isLocalBackupOpen)}
                  className="w-full px-6 py-6 flex items-center justify-between bg-emerald-100 hover:bg-emerald-200/70 transition-colors border-none text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[22px]">📂</span>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17.5px] font-black text-slate-800 tracking-tight">데이터 백업 및 가져오기</h3>
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-emerald-500 text-white flex-shrink-0">추천 / 무설정</span>
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-slate-500 transition-transform duration-200 ${isLocalBackupOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isLocalBackupOpen && (
                  <div className="p-5 flex flex-col gap-5 border-t border-slate-200/60 bg-white">

                    {/* Section A: 처음 오신 분 – AI 변환 & 샘플 */}
                    <div className="flex flex-col gap-3">
                      <span className="text-[13.5px] font-black text-indigo-600 uppercase tracking-wide">💡 처음이신가요? 기존 데이터 변환 &amp; 예시</span>

                      {/* AI 프롬프트 카드 */}
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 flex flex-col gap-3.5 shadow-sm">
                        <span className="text-[14px] font-extrabold text-slate-800">
                          🤖 AI 활용 기존 기록 파일 일괄 변환기
                        </span>
                        
                        <div className="text-[13px] text-slate-600 font-semibold leading-relaxed flex flex-col gap-2">
                          <p className="font-extrabold text-indigo-900">👉 기존에 관리하시던 강의 장부(엑셀/한글 표 등) 가져오는 법:</p>
                          <ol className="list-decimal pl-4.5 flex flex-col gap-1.5 text-slate-500">
                            <li>바로 아래의 <strong>[출강기록 양식 예시 CSV 받기]</strong>를 클릭하여 표준 서식 파일을 다운로드합니다.</li>
                            <li><strong>ChatGPT</strong> 또는 <strong>Claude</strong> 대화창에 <strong>선생님이 기존에 사용하시던 장부 파일</strong>과 <strong>방금 내려받은 예시 파일</strong> 두 개를 함께 업로드합니다.</li>
                            <li>아래 <strong>[AI 변환 프롬프트 복사하기]</strong> 버튼을 눌러 문구를 복사한 뒤 AI 대화창에 붙여넣기(Ctrl+V)하여 전송합니다.</li>
                            <li>AI가 생성해 준 결과 파일(또는 CSV 문구)을 저장해 하단의 <strong>[백업 파일 불러오기]</strong>로 가져오면 즉시 연동됩니다!</li>
                          </ol>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const promptText = `첨부한 두 개의 파일(나의 기존 데이터 파일 & 양식 예시 CSV 파일)을 참고하여, 나의 데이터를 양식 예시 CSV 파일의 헤더 규격 및 서식 규칙에 맞춰 완벽하게 변환해줘.

[CSV 헤더 규격]
기관명/학교,출강역할,강의단가,총 차시,예상수령액,교통비(+),공제율(%),공제금액(-),월,실수령액,날짜,등록일,정산여부

[출력 데이터 규격 및 형식 규칙]
- 헤더 규격: '기관명/학교,출강역할,강의단가,총 차시,예상수령액,교통비(+),공제율(%),공제금액(-),월,실수령액,날짜,등록일,정산여부' 순서의 열로 만들어줘.
- '날짜'와 '등록일' 서식: 반드시 'YYYY-MM-DD' 형식 (예: 2026-06-30)이어야 합니다. 날짜와 등록일의 연도는 일치해야 합니다. (등록일이 누락된 항목은 날짜의 연도를 복사해줘.)
- '출강역할' 서식: '주강사' 또는 '보조강사' 중 하나로 표준화해줘.
- '정산여부' 서식: 이미 돈을 지급받은 강의는 '정산완료', 아직 지급 대기 중인 강의는 '정산대기'로 변환해줘.
- '공제율(%)' 서식: '3.3' 또는 '8.8' 형태의 숫자만 입력해줘 (퍼센트 기호 '%'는 생략). 만약 기존 데이터에 공제율 정보가 없거나 비어있는 경우:
  1) 기존 데이터의 강의단가(또는 예상수령액)와 공제금액 간의 비율을 계산하여 알맞은 세율(3.3 또는 8.8)을 적어줘.
  2) 강의단가만 존재하고 공제금액 정보 자체가 비어있거나 생략된 경우, 기본값인 '8.8'을 적어줘.

[⚠️ 실수령액 처리 규칙 — 반드시 준수]
- '정산완료' 항목: 실수령액 = 예상수령액 + 교통비(+) - 공제금액(-) 으로 계산해서 입력해줘.
  공제금액(-) = 예상수령액 × 공제율(%)로 계산해줘. 예상수령액 = 강의단가 × 총 차시.
- '정산대기' 항목: 실수령액은 반드시 0으로 입력해줘. 공제금액(-)도 0으로 입력해줘.
  (아직 지급이 이루어지지 않은 항목이므로 실수령액과 공제금액은 0이어야 함)
  단, 예상수령액은 강의단가 × 총 차시로 계산해서 채워줘.

[주의 사항]
- '정산완료' 항목에 한해서만 실수령액과 공제금액을 계산해서 채워줘. '정산대기' 항목의 실수령액과 공제금액은 반드시 0이어야 해.
- 변환된 데이터는 바로 다운로드할 수 있는 .csv 파일(UTF-8 인코딩) 형태로 제공해줘.`;
                             navigator.clipboard.writeText(promptText).then(() => {
                               alert('AI 변환 프롬프트가 클립보드에 복사되었습니다!\n\nChatGPT 또는 Claude 창을 열고, [내 데이터 파일]과 [다운로드한 양식 예시 CSV] 두 개를 첨부한 뒤 복사한 메시지를 전송하세요.');
                             }).catch(() => {
                               alert('복사에 실패했습니다. 브라우저 주소창이 https:// 인지 확인해 주세요.');
                             });
                           }}
                           className="w-full py-3 bg-indigo-100 hover:bg-indigo-200/70 border border-indigo-200 text-indigo-700 text-[13px] font-black rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 text-center cursor-pointer"
                        >
                          📋 AI 변환 프롬프트 복사하기
                        </button>

                        {/* AI 바로가기 버튼 삼분할 */}
                        <div className="grid grid-cols-3 gap-2 mt-1.5">
                          <a
                            href="https://chatgpt.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2.5 px-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center transition active:scale-95 no-underline cursor-pointer min-h-[52px]"
                          >
                            <img src="/images/chatgpt.png" alt="ChatGPT" className="h-[35px] max-w-[95%] object-contain" />
                          </a>
                          <a
                            href="https://claude.ai/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2.5 px-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center transition active:scale-95 no-underline cursor-pointer min-h-[52px]"
                          >
                            <img src="/images/claude.png" alt="Claude" className="h-[42px] max-w-[95%] object-contain" />
                          </a>
                          <a
                            href="https://gemini.google.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2.5 px-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center transition active:scale-95 no-underline cursor-pointer min-h-[52px]"
                          >
                            <img src="/images/gemini.png" alt="Gemini" className="h-[42px] max-w-[95%] object-contain" />
                          </a>
                        </div>
                      </div>

                      {/* 예제 파일 다운로드 */}
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col gap-2 shadow-sm">
                        <span className="text-[14px] font-extrabold text-emerald-800">📄 작성 표준 양식 CSV 다운로드</span>
                        <p className="text-[13px] text-emerald-700 font-semibold leading-relaxed">
                          표준 날짜 서식이 올바르게 적용된 예제 양식 파일을 내 컴퓨터로 다운로드합니다.
                        </p>
                        <button onClick={handleDownloadSampleCSV}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[13.5px] font-black rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 border-none cursor-pointer">
                          <Download size={15} className="text-white" />
                          출강기록 양식 예시 CSV 받기
                        </button>
                      </div>
                    </div>
                    <div className="h-px bg-slate-100" />

                    {/* Section B: 내 데이터 백업 & 복원 */}
                    <div className="flex flex-col gap-3">
                      <span className="text-[13.5px] font-black text-slate-600 uppercase tracking-wide">📦 내 데이터 백업 및 복원</span>

                      {/* 📤 내보내기 */}
                      <div className="border border-slate-200 rounded-2xl p-5 flex flex-col gap-3 bg-white shadow-sm">
                        <span className="text-[14px] font-extrabold text-slate-800">📤 [보내기] 내 기록 파일로 백업</span>
                        <p className="text-[13px] text-slate-500 font-semibold leading-relaxed">
                          현재 대시보드에 입력된 모든 출강 기록을 기기에 파일로 내려받아 보관합니다.
                        </p>
                        <button onClick={handleExportCSV}
                          className="w-full py-3 bg-[#1F2E5B] hover:bg-[#172346] text-white text-[13.5px] font-black rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 border-none cursor-pointer">
                          <Upload size={15} className="text-white" />
                          현재 내 모든 기록 내보내기 (백업 파일 내려받기)
                        </button>
                      </div>

                      {/* 📥 가져오기 */}
                      <div className="border border-slate-200 rounded-2xl p-5 flex flex-col gap-3 bg-white shadow-sm">
                        <span className="text-[14px] font-extrabold text-slate-800">📥 [가져오기] 백업 파일 불러오기</span>
                        <p className="text-[13px] text-slate-500 font-semibold leading-relaxed">
                          이전에 백업해둔 CSV 파일을 불러와 현재 강의 리스트 뒤에 추가 및 병합합니다. 날짜 형식은 반드시 YYYY-MM-DD(예: 2026-06-30)여야 합니다.
                        </p>
                        <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-6 bg-[#F8FAF8] hover:bg-slate-50 transition-colors flex flex-col items-center justify-center text-center">
                          <input type="file" accept=".csv" onChange={handleAnimatedUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" disabled={isUploading} />
                          <div className={`p-3 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-2.5 ${isUploading ? 'upload-pulse' : 'cloud-float'}`}>
                            <Cloud size={28} className="text-[#2563EB]" />
                          </div>
                          {isUploading ? (
                            <div className="w-full max-w-[200px] flex flex-col items-center gap-1.5">
                              <span className="text-[12px] font-bold text-[#2563EB]">파일을 파싱하는 중...</span>
                              <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-[#2563EB] transition-all duration-75" style={{width: `${uploadProgress}%`}} />
                              </div>
                              <span className="text-[11px] text-slate-450 font-extrabold">{uploadProgress}%</span>
                            </div>
                          ) : (
                            <>
                              <span className="text-[14px] font-black text-slate-800">CSV 백업 파일 선택 / 드래그</span>
                              <p className="text-[12px] text-slate-400 mt-1 font-semibold">이곳을 누르거나 백업된 CSV 파일을 끌어오세요.</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* API Settings Accordion - Moved to Second */}
              <div className="rounded-[24px] bg-violet-50/10 border border-violet-200 overflow-hidden shadow-sm transition-all">
                <button
                  type="button"
                  onClick={() => setIsApiSettingsOpen(!isApiSettingsOpen)}
                  className="w-full px-6 py-6 flex items-center justify-between bg-violet-100 hover:bg-violet-200/70 transition-colors border-none text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[22px]">🤖</span>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17.5px] font-black text-slate-800 tracking-tight">AI 분석 연동 설정</h3>
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-violet-500 text-white flex-shrink-0" style={{backgroundColor: '#8B5CF6'}}>선택 사항</span>
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-slate-500 transition-transform duration-200 ${isApiSettingsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isApiSettingsOpen && (
                  <div className="p-5 flex flex-col gap-4 border-t border-slate-200/60 bg-white">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[13px] font-black text-slate-600">Gemini AI API Key</label>
                          <button type="button" onClick={() => alert('Google AI Studio (aistudio.google.com)에서 무료 발급\n\n1. aistudio.google.com 접속\n2. Get API Key 클릭\n3. Create API Key 클릭\n4. 발급된 키 복사 후 입력')} className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><span className="text-[11px] font-black">?</span></button>
                        </div>
                        <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#2563EB] hover:text-blue-800 underline font-extrabold">👉 API Key 무료 발급 바로가기</a>
                      </div>
                      {!isEditingApiKey && apiKey ? (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 shadow-sm">
                          <span className="text-[12.5px] font-extrabold text-emerald-800 flex items-center gap-1.5">
                            🔒 API 키가 등록되었습니다.
                          </span>
                          <button 
                            type="button" 
                            onClick={() => setIsEditingApiKey(true)} 
                            className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 font-black rounded-lg text-xs hover:bg-slate-50 transition active:scale-95 cursor-pointer shadow-sm"
                          >
                            변경
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input type="password" id="settings-api-key-mobile" defaultValue={apiKey} placeholder="AIzaSy... (Gemini API Key)" className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-[13px] font-semibold focus:outline-none focus:border-[#2563EB] bg-[#F8FAFC] text-slate-800 placeholder-slate-450" />
                          <button 
                            onClick={() => {
                              const k = document.getElementById('settings-api-key-mobile').value;
                              handleSaveSettings(k, sheetUrl, spreadsheetUrl);
                            }}
                            className="px-4 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black rounded-xl text-[13px] transition shadow-sm cursor-pointer"
                          >
                            저장
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Cloud Sync Accordion - Moved to Third */}
              <div className="rounded-[24px] bg-sky-50/10 border border-sky-200 overflow-hidden shadow-sm transition-all">
                <button
                  type="button"
                  onClick={() => setIsCloudBackupOpen(!isCloudBackupOpen)}
                  className="w-full px-6 py-6 flex items-center justify-between bg-sky-100 hover:bg-sky-200/70 transition-colors border-none text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[22px]">☁️</span>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17.5px] font-black text-slate-800 tracking-tight">실시간 클라우드 동기</h3>
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-sky-500 text-white flex-shrink-0">고급 기능</span>
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-slate-500 transition-transform duration-200 ${isCloudBackupOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isCloudBackupOpen && (
                  <div className="p-5 flex flex-col gap-4 border-t border-slate-200/60 bg-white">
                    <div className="p-4 bg-blue-50/70 border border-blue-100 text-[#1E3A8A] rounded-xl font-semibold leading-relaxed flex flex-col gap-1.5 text-[13px]">
                      <p className="font-black text-[14px] flex items-center gap-1">☁️ 클라우드 동기화 안내</p>
                      <p className="text-slate-500">구글 스프레드시트 배포 URL을 연동하면 기기 간 데이터가 백업 버튼 조작 없이 저장 시 실시간으로 자동 동기화됩니다. 인터넷 연결 시 자동으로 최신 데이터가 반영됩니다.</p>
                      <p className="text-[11.5px] text-[#2563EB] font-black mt-1 leading-normal">
                        💡 안내: 구글 시트 연동이 복잡하다면 생략하셔도 좋습니다. 대시보드는 로컬 데이터로도 한계 없이 안전하게 동작하며, 주기적으로 위의 [데이터 백업 및 가져오기]에서 백업 파일을 받아 보관하시는 방법이 가장 쉽고 편리합니다.
                      </p>
                      <div className="mt-1.5">
                        <button type="button" onClick={() => setIsScriptModalOpen(true)} className="text-[12px] font-black text-white bg-[#1E3A8A] px-3.5 py-2 rounded-lg hover:bg-[#0F172A] transition border-none cursor-pointer">구글 시트 연동 방법 보기</button>
                      </div>
                    </div>

                    {/* 구글 시트 URL 입력 및 저장란 */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-black text-slate-600">구글 시트 웹 앱 URL <span className="text-[#EF4444] font-black text-[11.5px]">(반드시 배포된 *exec 주소여야 합니다)</span></label>
                      {!isEditingSheetUrl && sheetUrl ? (
                        <div className="flex flex-col gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm w-full">
                          <span className="text-[12.5px] font-extrabold text-emerald-800 flex items-center gap-1.5">
                            ☁️ 구글 시트 연동 주소(exec)가 등록되었습니다.
                          </span>
                          <div className="flex gap-2 mt-1">
                            <a
                              href={spreadsheetUrl || `${sheetUrl}${sheetUrl.includes('?') ? '&' : '?'}open=true`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-[11.5px] shadow-sm transition active:scale-95 text-center no-underline cursor-pointer flex items-center justify-center gap-1"
                            >
                              <span>📊 연동된 시트 확인하기</span>
                            </a>
                            <button 
                              type="button" 
                              onClick={() => setIsEditingSheetUrl(true)} 
                              className="px-4 py-2 bg-white border border-slate-250 text-slate-600 font-black rounded-xl text-[11.5px] hover:bg-slate-50 transition active:scale-95 cursor-pointer shadow-sm"
                            >
                              변경
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              id="settings-sheet-url-mobile" 
                              defaultValue={sheetUrl} 
                              placeholder="예시주소: https://script.google.com/macros/s/.../exec" 
                              className="flex-1 px-4 py-3 border border-slate-250 rounded-xl text-[13px] font-semibold focus:outline-none focus:border-[#2563EB] bg-[#F8FAFC] text-slate-800 placeholder-slate-450" 
                            />
                            <button 
                              onClick={() => {
                                const u = document.getElementById('settings-sheet-url-mobile').value;
                                handleTestAndSaveSheetUrl(u, false);
                              }}
                              disabled={isTestingSheetUrl}
                              className="px-4 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black rounded-xl text-[13px] transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[70px]"
                            >
                              {isTestingSheetUrl ? '확인중...' : '저장'}
                            </button>
                          </div>
                          
                          {sheetUrlError && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4.5 mt-2 flex flex-col gap-2.5">
                              <p className="font-black text-amber-800 text-[12.5px] flex items-center gap-1.5">
                                ⚠️ 최초 연동을 위한 구글 권한 승인이 필요합니다
                              </p>
                              <p className="text-slate-600 font-semibold leading-relaxed text-[11px]">
                                구글의 보안 정책상, 최초 1회는 브라우저를 통해 웹 앱 사용 권한을 허용해 주셔야 대시보드 연동이 활성화됩니다.
                              </p>
                              <a
                                href={`${document.getElementById('settings-sheet-url-mobile')?.value || ''}${
                                  (document.getElementById('settings-sheet-url-mobile')?.value || '').includes('?') ? '&' : '?'
                                }open=true`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-center text-[11.5px] no-underline block shadow-sm transition active:scale-95 cursor-pointer"
                              >
                                🔑 구글 권한 승인 완료하기 (새 창)
                              </a>
                              <p className="text-slate-450 text-[10px] leading-normal font-medium mt-0.5">
                                ※ 위 버튼을 누르면 구글 권한 검토 화면이 열립니다. <br/>
                                <strong>[Review Permissions] (권한 검토) ➡️ [고급] ➡️ [이동] ➡️ [허용]</strong>을 완료해 주신 후, 다시 위의 <strong>[저장]</strong> 버튼을 눌러주세요.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {!sheetUrl ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl font-semibold text-center text-[10.5px]">
                        구글 시트 웹 앱 URL을 입력하고 저장하시면 클라우드 실시간 동기가 활성화됩니다.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 mt-1">
                        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl font-semibold text-[13px] leading-relaxed flex flex-col gap-1.5">
                          <span className="font-black text-[14px] flex items-center gap-1">✨ 실시간 자동 동기화 활성화됨</span>
                          <span className="text-emerald-700 text-[12px]">대시보드에서 일정을 등록, 수정, 삭제하거나 정산 완료 처리를 하시면 백업 버튼을 따로 누르지 않아도 사용자의 구글 시트에 실시간으로 자동 저장됩니다.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 고객지원 및 앱 관리 아코디언 */}
              <div className="rounded-[24px] bg-slate-50/10 border border-slate-200 overflow-hidden shadow-sm transition-all">
                <button
                  type="button"
                  onClick={() => setIsAppSupportOpen(!isAppSupportOpen)}
                  className="w-full px-6 py-6 flex items-center justify-between bg-slate-100 hover:bg-slate-200/70 transition-colors border-none text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[22px] select-none">⚙️</span>
                    <h3 className="text-[17.5px] font-black text-slate-800 tracking-tight">고객지원 및 앱 관리</h3>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-slate-500 transition-transform duration-200 ${isAppSupportOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isAppSupportOpen && (
                  <div className="p-5 flex flex-col gap-5 border-t border-slate-200/60 bg-white">
                    {/* 카카오톡 문의하기 */}
                    <div className="flex flex-col gap-2.5">
                      <span className="text-[13.5px] font-black text-[#1E3A8A] uppercase tracking-wide">💬 1:1 고객지원 문의</span>
                      <a 
                        href="https://open.kakao.com/o/s8Fu8RBi" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-[#FEE500] hover:bg-[#FAD000] text-[#191919] font-black text-[13px] rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer border-none no-underline"
                      >
                        <span>카카오톡 문의하기</span>
                        <span className="text-sm">💬</span>
                      </a>
                    </div>

                    {/* Danger zone (기록 데이터 초기화) */}
                    <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2"><AlertCircle size={16} className="text-red-500" /><span className="text-[13.5px] font-black text-red-700">기록 데이터 초기화</span></div>
                      <p className="text-[12px] text-red-600/70 leading-relaxed font-semibold">모든 출강기록과 API 연동 키를 삭제하며, 복구할 수 없습니다.</p>
                      <button 
                        onClick={() => { if(window.confirm('정말 전체 초기화하시겠습니까?')){safeLocalStorage.clear();setLectures([]);setApiKey('');setSheetUrl('');alert('초기화 완료. 새로고침합니다.');window.location.reload();}}} 
                        className="w-full py-3 text-[13px] font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-sm border-none cursor-pointer active:scale-95"
                      >
                        앱 전체 데이터 초기화
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Information footer (outside accordion) */}
              <div className="py-2.5 flex flex-col items-center justify-center text-center gap-1.5 select-none mt-2">
                <p className="text-[11px] text-slate-400 font-bold whitespace-nowrap leading-none">
                  프리랜서 강사를 위한 강의료 정산 스마트 대시보드 v1.0.0
                </p>
                <p className="text-[9.5px] text-slate-400 font-semibold whitespace-nowrap leading-none">
                  © 2026. 출강바이브. All rights reserved.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* iOS-style Bottom Navigation Bar — fixed bottom-4 on mobile, absolute bottom-3 on desktop mockup */}
        <div className="fixed bottom-4 md:absolute md:bottom-3 left-4 right-4 z-40 rounded-3xl border border-slate-200/80 shadow-2xl" style={{background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', paddingBottom: '0px'}}>
          <div className="flex items-center justify-around py-2 px-2">
            {[
              {id:'home', icon:<Home size={22}/>, label:'현황'},
              {id:'calendar', icon:<Calendar size={22}/>, label:'달력'},
              {id:'add', icon:<Plus size={22}/>, label:'기록', isCenter: true},
              {id:'stats', icon:<BarChart size={22}/>, label:'분석'},
              {id:'settings', icon:<Settings size={22}/>, label:'설정'}
            ].map(t => {
              if (t.isCenter) {
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setEditingLecture(null);
                      setFormData({
                        institution: '',
                        role: 'Main',
                        rate: 100000,
                        classes: 4,
                        transportFee: 0,
                        date: new Date().toISOString().slice(0, 10),
                        registrationDate: new Date().toISOString().slice(0, 10),
                        isPaid: false,
                        taxRate: '3.3%',
                        taxBase: 'LectureOnly',
                        customTax: 0,
                        _newPresetName: '',
                        _newPresetRate: '',
                        _newPresetRole: 'Main',
                        _newPresetTax: '3.3%',
                        _newPresetEmoji: null,
                        _showEmojiPicker: false,
                        _tab: 'record'
                      });
                      setIsAddModalOpen(true);
                    }}
                    className="btn-press flex flex-col items-center justify-center w-[52px] h-[52px] rounded-full bg-[#2563EB] text-white shadow-lg shadow-blue-500/30 -mt-[4px] flex-shrink-0 border-[3px] border-white"
                    style={{
                      transition: 'transform 200ms'
                    }}
                  >
                    <Plus size={22} className="text-white" />
                    <span className="text-[11px] font-black text-white leading-none mt-0.5">{t.label}</span>
                  </button>
                );
              }
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className="btn-press relative flex flex-col items-center gap-1.5 py-2 px-3.5 rounded-2xl"
                  style={{
                    color: activeTab === t.id ? '#2563EB' : '#94a3b8',
                    background: activeTab === t.id ? 'rgba(37,99,235,0.06)' : 'transparent',
                    transition: 'color 200ms, background 200ms'
                  }}
                >
                  <span style={{transform: activeTab === t.id ? 'scale(1.12)' : 'scale(1)', transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)', display: 'block'}}>
                    {t.icon}
                  </span>
                  <span style={{fontSize: '11px', fontWeight: activeTab === t.id ? 800 : 600, letterSpacing: activeTab === t.id ? '-0.01em' : 0, lineHeight: 1}}>{t.label}</span>
                  {activeTab === t.id && (
                    <span style={{position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'24px', height:'2.5px', borderRadius:'99px', background:'#2563EB'}} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
{/* ========================================================
          [MODAL 3]: Add/Edit Lecture Modal — Redesigned with Preset Picker
         ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 flex items-stretch md:items-center justify-center p-0 md:p-4 z-50 backdrop-blur-fade">
          <div className="bg-white w-full md:max-w-md h-full md:h-auto rounded-none md:rounded-[28px] flex flex-col pb-6 md:pb-0 shadow-2xl md:modal-zoom-in overflow-hidden" style={{boxShadow: '0 -4px 40px rgba(31,46,91,0.18)'}}>

            {/* Folder-Tab style Header: 직접 등록 / 즐겨찾기 선택 */}
            <div className="px-5 pt-4 pb-0 flex items-end justify-between bg-slate-100 border-b border-slate-200">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, _tab: 'record' }))}
                  className="px-5 py-3 text-[13px] font-black rounded-t-2xl transition-all border-t border-x duration-200"
                  style={{
                    color: (formData._tab || 'record') === 'record' ? '#1E3A8A' : '#FFFFFF',
                    backgroundColor: (formData._tab || 'record') === 'record' ? '#FFFFFF' : '#1E3A8A',
                    borderColor: (formData._tab || 'record') === 'record' ? '#CBD5E1 #CBD5E1 transparent #CBD5E1' : '#1E3A8A',
                    borderTopWidth: '3px',
                    transform: (formData._tab || 'record') === 'record' ? 'translateY(1px) scale(1.05)' : 'translateY(3px) scale(0.92)',
                    zIndex: (formData._tab || 'record') === 'record' ? 20 : 10,
                    boxShadow: (formData._tab || 'record') === 'record' ? '0 -3px 8px rgba(30,58,138,0.08)' : 'none',
                    transformOrigin: 'bottom center'
                  }}
                >
                  {editingLecture ? '기록 수정 ✏️' : '직접 등록 ✍️'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, _tab: 'presets' }))}
                  className="px-5 py-3 text-[13px] font-black rounded-t-2xl transition-all border-t border-x duration-200"
                  style={{
                    color: (formData._tab || 'record') === 'presets' ? '#1E3A8A' : '#FFFFFF',
                    backgroundColor: (formData._tab || 'record') === 'presets' ? '#FFFFFF' : '#1E3A8A',
                    borderColor: (formData._tab || 'record') === 'presets' ? '#CBD5E1 #CBD5E1 transparent #CBD5E1' : '#1E3A8A',
                    borderTopWidth: '3px',
                    transform: (formData._tab || 'record') === 'presets' ? 'translateY(1px) scale(1.05)' : 'translateY(3px) scale(0.92)',
                    zIndex: (formData._tab || 'record') === 'presets' ? 20 : 10,
                    boxShadow: (formData._tab || 'record') === 'presets' ? '0 -3px 8px rgba(30,58,138,0.08)' : 'none',
                    transformOrigin: 'bottom center'
                  }}
                >
                  즐겨찾기 선택 ⭐
                </button>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl mb-2.5 transition border-none bg-transparent cursor-pointer flex items-center justify-center">
                <X size={18} />
              </button>
            </div>

            {/* ─── TAB: 출강 기록 ─── */}
            {(formData._tab || 'record') === 'record' && (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-5 flex flex-col gap-4.5 text-sm">

                {/* 즐겨찾기 피커 */}
                <div className="flex flex-col gap-2 p-4 rounded-2xl" style={{background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)', border: '1px solid rgba(30, 58, 138, 0.12)'}}>
                  <label className="font-black text-[11px] text-[#1E3A8A] flex items-center gap-1.5">
                    <span style={{fontSize:'14px'}}>★</span> 즐겨찾기 적용 (선택 시 자동 완성)
                  </label>
                  <select
                    value={formData._selectedPreset || ''}
                    onChange={(e) => {
                      const presetId = e.target.value;
                      if (!presetId) {
                        setFormData(prev => ({ ...prev, _selectedPreset: '', _presetLocked: false }));
                        return;
                      }
                      const preset = presets.find(p => p.id === presetId);
                      if (preset) {
                        setFormData(prev => ({
                          ...prev,
                          _selectedPreset: presetId,
                          _presetLocked: true,
                          institution: preset.name,
                          role: preset.role || 'Main',
                          rate: preset.rate,
                          classes: preset.classes || prev.classes || 2,
                          transportFee: preset.transportFee || 0,
                          taxRate: preset.taxRate || '3.3%',
                          date: prev.date || `${new Date().getMonth() + 1}월 ${new Date().getDate()}일`
                        }));
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-800 appearance-none"
                    style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%231E3A8A' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center'}}
                  >
                    <option value="">직접 입력 (즐겨찾기 미사용)</option>
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.role === 'Assistant' ? '보조' : '주강사'} · {formatWon(p.rate)}원/h · {p.taxRate}
                      </option>
                    ))}
                  </select>
                  {formData._presetLocked && (
                    <p className="text-[9.5px] text-blue-600 font-semibold mt-0.5">
                      ✓ 즐겨찾기가 적용되었습니다. 기관명/단가/세율이 잠금 처리됩니다.
                    </p>
                  )}
                </div>

                {/* 기관명 */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-600 text-[11.5px]">기관 / 교육장명 <span className="text-red-500 font-extrabold">*</span></label>
                  <input
                    type="text"
                    name="institution"
                    required
                    value={formData.institution}
                    onChange={handleInputChange}
                    readOnly={!!formData._presetLocked}
                    placeholder="예: 사회복지협의회/목포경애원"
                    list="presets-modal"
                    className="px-4 py-3 border rounded-xl focus:outline-none focus:border-[#1E3A8A] text-[12px] font-semibold transition-all"
                    style={{
                      background: formData._presetLocked ? '#F1F5F9' : 'white',
                      borderColor: formData._presetLocked ? '#E2E8F0' : 'rgba(30,58,138,0.15)',
                      color: formData._presetLocked ? '#64748B' : '#0F172A'
                    }}
                  />
                  {!formData._presetLocked && (
                    <datalist id="presets-modal">
                      {uniqueInstitutions.map((i, idx) => <option key={idx} value={i} />)}
                    </datalist>
                  )}
                </div>

                {/* 출강 구분 */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-600 text-[11.5px]">출강 구분 <span className="text-red-500 font-extrabold">*</span></label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, role: 'Main' }))}
                      className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                        formData.role === 'Main'
                          ? 'bg-[#1E3A8A] text-white shadow-sm font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      주강사
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, role: 'Assistant' }))}
                      className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                        formData.role === 'Assistant'
                          ? 'bg-[#1E3A8A] text-white shadow-sm font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      보조강사
                    </button>
                  </div>
                </div>

                {/* 타이트 가로 그리드 배치: 강의 단가 & 총 차시 */}
                <div className="grid grid-cols-2 gap-3">
                  {/* 강의 단가 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-600 text-[11.5px]">강의 단가 (시간당) <span className="text-red-500 font-extrabold">*</span></label>
                    <input
                      type="number"
                      name="rate"
                      required
                      max="150000"
                      value={formData.rate}
                      onChange={handleInputChange}
                      readOnly={!!formData._presetLocked}
                      className="px-4 py-2.5 border rounded-xl focus:outline-none focus:border-[#1E3A8A] text-[12px] font-bold transition-all"
                      style={{
                        background: formData._presetLocked ? '#F1F5F9' : 'white',
                        borderColor: formData._presetLocked ? '#E2E8F0' : 'rgba(30,58,138,0.15)',
                        color: formData._presetLocked ? '#64748B' : '#0F172A'
                      }}
                    />
                  </div>

                  {/* 총 차시 피커 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-600 text-[11.5px]">총 강의 시간 (차시) <span className="text-red-500 font-extrabold">*</span></label>
                    <select
                      name="classes"
                      value={formData.classes}
                      onChange={(e) => setFormData(prev => ({ ...prev, classes: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-center font-black text-[12px] text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                    >
                      {Array.from({length: 16}, (_, i) => i + 1).map(c => (
                        <option key={c} value={c}>{c}차시</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 추가 교통비 (선택) */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-500 text-[11px]">추가 교통비 (선택)</label>
                  <input
                    type="number"
                    name="transportFee"
                    value={formData.transportFee}
                    onChange={handleInputChange}
                    placeholder="교통비 미지원시 비워둠"
                    className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A8A] bg-white text-[12px] font-semibold"
                  />
                </div>

                {/* 구체적 날짜 */}
                <div className="relative flex flex-col gap-1.5">
                  <label className="font-bold text-slate-500 text-[11px]">출강 날짜</label>
                  <div className="relative">
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between text-[13px] font-black text-slate-800">
                      <span>{formatDateDisplayFull(formData.date)}</span>
                      <Calendar size={14} className="text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* 공제 세율 설정 (선택) */}
                <div className="p-4 rounded-2xl flex flex-col gap-3" style={{background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', border: '1px solid rgba(30,58,138,0.08)'}}>
                  <span className="font-black text-[11px] text-slate-700">공제 세율 설정 (선택)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-semibold">세율</label>
                      <select
                        name="taxRate"
                        value={formData.taxRate}
                        onChange={handleInputChange}
                        disabled={!!formData._presetLocked}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold"
                        style={{opacity: formData._presetLocked ? 0.6 : 1}}
                      >
                        <option value="3.3%">3.3% (사업소득)</option>
                        <option value="8.8%">8.8% (기타소득)</option>
                        <option value="None">세금 없음 (0%)</option>
                        <option value="Custom">직접 입력</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 font-semibold">과세기준</label>
                      <select
                        name="taxBase"
                        value={formData.taxBase}
                        onChange={handleInputChange}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold"
                      >
                        <option value="LectureOnly">강의료만 과세</option>
                        <option value="Total">합계액 전체 과세</option>
                      </select>
                    </div>
                  </div>
                  {formData.taxRate === 'Custom' && (
                    <input
                      type="number"
                      name="customTax"
                      value={formData.customTax}
                      onChange={handleInputChange}
                      placeholder="세액 직접 입력"
                      className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-[11px] font-bold"
                    />
                  )}
                </div>

                {/* 정산 완료 체크 */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    id="modal-isPaid"
                    name="isPaid"
                    checked={formData.isPaid}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-[#1E3A8A] border-slate-300 rounded cursor-pointer accent-[#1E3A8A]"
                  />
                  <label htmlFor="modal-isPaid" className="font-bold text-slate-600 cursor-pointer select-none text-[11px]">
                    이미 강의료 입금이 완료되었습니다
                  </label>
                </div>

                {/* 하단 액션 버튼 */}
                <div className="flex gap-3 mt-2 sticky bottom-0 bg-white pt-3 pb-1">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-xl text-[11px]"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-3 bg-[#1E3A8A] hover:bg-[#0F172A] text-white font-black rounded-xl shadow-md text-[12px] transition-all"
                  >
                    {editingLecture ? '수정 완료' : '기록 저장'}
                  </button>
                </div>
              </form>
            )}

            {/* ─── TAB: 즐겨찾기 편집 ─── */}
            {(formData._tab || 'record') === 'presets' && (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 text-xs">
                <p className="text-[10px] text-slate-400 font-semibold">자주 출강하는 기관 정보를 등록해두면 원터치로 빠르게 채워집니다.</p>
                <div className="flex flex-col gap-2.5">
                  {presets.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-[12px] text-[#0F172A] truncate">{p.name}</div>
                        <div className="text-[10px] text-[#475569] mt-0.5 font-semibold">{p.role === 'Assistant' ? '보조강사' : '주강사'} | {formatWon(p.rate)}원/시간 | 세율 {p.taxRate}</div>
                      </div>
                      <button type="button" onClick={() => { if (window.confirm(`"${p.name}" 즐겨찾기를 삭제하시겠습니까?`)) setPresets(prev => prev.filter(x => x.id !== p.id)); }} className="ml-3 p-2 text-red-400 hover:bg-red-50 rounded-xl transition flex-shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-2xl flex flex-col gap-3" style={{background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)', border: '1px dashed rgba(30,58,138,0.25)'}}>
                  <span className="font-black text-[11.5px] text-[#1E3A8A]">⭐ 새 즐겨찾기 추가</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, _showEmojiPicker: !prev._showEmojiPicker }))} className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                      {formData._newPresetEmoji || <span className="text-[10px] text-slate-400 font-extrabold">없음</span>}
                    </button>
                    <input type="text" placeholder="기관명 입력" value={formData._newPresetName || ''} onChange={e => setFormData(prev => ({ ...prev, _newPresetName: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-xl bg-white text-[11px] font-bold focus:outline-none focus:border-[#1E3A8A]" />
                  </div>
                  {formData._showEmojiPicker && (
                    <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-3 flex flex-col gap-2 mt-1">
                      <div className="text-[10px] text-slate-400 font-bold">이모지 선택</div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {['🌱', '💻', '🤖', '⛺', '🎒', '🏫', '👔', '🏢', '🗂️', '🏠'].map(e => (
                          <button key={e} type="button" onClick={() => setFormData(prev => ({ ...prev, _newPresetEmoji: e, _showEmojiPicker: false }))} className="w-8 h-8 rounded-lg hover:bg-blue-50 flex items-center justify-center text-lg">{e}</button>
                        ))}
                      </div>
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, _newPresetEmoji: null, _showEmojiPicker: false }))} className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors border-none mt-1 cursor-pointer">이모지 사용 안함 (❌)</button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <select value={formData._newPresetRole || 'Main'} onChange={e => setFormData(prev => ({ ...prev, _newPresetRole: e.target.value }))} className="px-3 py-2 bg-white border border-blue-100 rounded-xl text-[11px] font-bold"><option value="Main">주강사</option><option value="Assistant">보조강사</option></select>
                    <input type="number" placeholder="시간당 단가(원)" value={formData._newPresetRate || ''} onChange={e => setFormData(prev => ({ ...prev, _newPresetRate: e.target.value }))} className="px-3 py-2 border border-blue-100 rounded-xl bg-white text-[11px] font-bold focus:outline-none" />
                  </div>
                  <select value={formData._newPresetTax || '3.3%'} onChange={e => setFormData(prev => ({ ...prev, _newPresetTax: e.target.value }))} className="px-3 py-2 bg-white border border-blue-100 rounded-xl text-[11px] font-bold"><option value="3.3%">공제세율 3.3% (기본)</option><option value="8.8%">공제세율 8.8%</option><option value="None">공제 없음 (0%)</option></select>
                  <button type="button" onClick={() => {
                    const name = (formData._newPresetName || '').trim();
                    if (!name) {
                      alert('기관명을 입력해 주세요.');
                      return;
                    }
                    const emoji = formData._newPresetEmoji;
                    const finalName = emoji ? `${emoji} ${name}` : name;
                    setPresets(prev => [
                      ...prev,
                      {
                        id: `p-${Date.now()}`,
                        name: finalName,
                        role: formData._newPresetRole || 'Main',
                        rate: Number(formData._newPresetRate) || 100000,
                        classes: 2,
                        transportFee: 0,
                        taxRate: formData._newPresetTax || '3.3%'
                      }
                    ]);
                    setFormData(prev => ({
                      ...prev,
                      _newPresetName: '',
                      _newPresetRate: '',
                      _newPresetRole: 'Main',
                      _newPresetTax: '3.3%',
                      _newPresetEmoji: null,
                      _showEmojiPicker: false
                    }));
                    alert('즐겨찾기가 저장되었습니다!');
                  }} className="w-full py-2.5 bg-[#1E3A8A] hover:bg-[#0F172A] text-white font-black rounded-xl text-[11.5px] shadow-sm transition border-none cursor-pointer">새 즐겨찾기 추가 저장</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          [MODAL 4]: AI Scan Modal (Desktop: centered / Mobile: Bottom Sheet)
         ======================================================== */}
      {isAiModalOpen && (
        <div className="fixed inset-0 flex items-stretch md:items-center justify-center p-0 md:p-4 z-50 backdrop-blur-fade">
          <div className="bg-white w-full md:max-w-xl h-full md:h-auto rounded-none md:rounded-[28px] overflow-y-auto flex flex-col pb-8 md:pb-0 shadow-2xl md:modal-zoom-in" style={{boxShadow: '0 -4px 40px rgba(31,46,91,0.18)'}}>


            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white text-slate-800">
              <h3 className="text-[16px] font-black text-slate-800 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-500 animate-pulse animate-duration-1000">
                  <defs>
                    <linearGradient id="gemini-logo-grad-modal" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2563EB" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2C12 2 12.3 8.5 4 12C12.3 12 12 22 12 22C12 22 11.7 12 20 12C11.7 8.5 12 2 12 2Z" fill="url(#gemini-logo-grad-modal)" />
                </svg>
                {isAiVerifying ? 'AI 분석 결과 검토' : 'AI 일정 등록'}
              </h3>
              <button
                onClick={() => {
                  setIsAiModalOpen(false);
                  setIsAiVerifying(false);
                }}
                className="p-1.5 text-[#2563EB] hover:bg-blue-50 rounded-xl transition border-none bg-transparent cursor-pointer flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {!isAiVerifying ? (
              <div className="p-6 flex flex-col gap-5 text-sm bg-gradient-to-b from-indigo-50/20 to-white">
                <p className="text-slate-500 font-semibold leading-relaxed text-[13px]">
                  전달받은 안내 공지 메시지를 아래에 붙여넣으시면, AI가 일련번호, 장소, 시간, 강사료 등을 정확하게 추출하여 기록해 드립니다.
                </p>

                {!apiKey && (
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-[20px] text-[13.5px] font-black text-amber-800 leading-relaxed flex items-start gap-3 shadow-sm animate-pulse" style={{ animationDuration: '3s' }}>
                    <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                    <div className="flex flex-col gap-1">
                      <span className="text-[13.5px] font-black text-amber-900 flex items-center gap-1">⚠️ Gemini API Key 등록 필요</span>
                      <p className="text-[11.5px] text-amber-700 font-bold leading-normal">
                        이 기능을 사용하려면 [설정] 탭에서 <strong>Gemini API Key</strong>를 등록하셔야 합니다. API 키는 <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline font-black hover:text-amber-800">Google AI Studio</a>에서 무료로 쉽게 발급받을 수 있습니다.
                      </p>
                    </div>
                  </div>
                )}

                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  disabled={aiLoading}
                  placeholder={`[메시지 본문을 이곳에 입력해주세요]
예시:
2026 디지털 정보화 교육 안내
- 11/19(화) 09:00~12:00 (3차시) 광주사회복지회관
- 강사료: 시간당 10만원 (교통비 2만원 별도)`}
                  className="w-full h-[280px] md:h-[220px] px-4 py-3 border border-indigo-150 rounded-2xl focus:outline-none focus:border-indigo-500 bg-white/70 backdrop-blur shadow-inner resize-none text-[13.5px] font-medium text-slate-800 transition-all placeholder-slate-400"
                />

                {aiLoading && (
                  <div className="p-4 bg-indigo-50/80 border border-indigo-100/60 rounded-2xl flex flex-col items-center justify-center gap-2 animate-pulse">
                    <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-[12.5px]">
                      <svg className="animate-spin h-4 w-4 text-indigo-650" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isMockParseResult ? 'AI가 예시 일정 텍스트를 입력하는 중...' : 'AI가 핵심 정보를 추출하고 있습니다...'}
                    </div>
                  </div>
                )}

                {aiError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-toss-red rounded-lg">
                    {aiError}
                  </div>
                )}

                <div className="flex flex-col gap-3 mt-1">
                  {/* Button 1: AI 분석 (AI 분석 시작) */}
                  <button
                    type="button"
                    onClick={handleAiParse}
                    disabled={aiLoading || !aiText.trim() || !apiKey}
                    className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-black rounded-xl disabled:bg-blue-300 shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : 'AI 분석 시작'}
                  </button>

                  {/* Button 2: AI 일정등록 (일정 직접 등록) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAiModalOpen(false);
                      setEditingLecture(null);
                      setFormData({
                        institution: '',
                        role: 'Main',
                        rate: 100000,
                        classes: 4,
                        transportFee: 0,
                        date: new Date().toISOString().slice(0, 10),
                        registrationDate: new Date().toISOString().slice(0, 10),
                        isPaid: false,
                        taxRate: '3.3%',
                        taxBase: 'LectureOnly',
                        customTax: 0,
                        _newPresetName: '',
                        _newPresetRate: '',
                        _newPresetRole: 'Main',
                        _newPresetTax: '3.3%',
                        _newPresetEmoji: null,
                        _showEmojiPicker: false,
                        _tab: 'record'
                      });
                      setIsAddModalOpen(true);
                    }}
                    disabled={aiLoading}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <span>일정 직접 등록 (수동)</span>
                  </button>

                  {/* Button 3: 내 시뮬레이션 (Simulation) - Hidden if apiKey exists */}
                  {!apiKey && (
                    <button
                      type="button"
                      onClick={handleMockParse}
                      disabled={aiLoading}
                      className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black rounded-xl hover:from-indigo-600 hover:to-purple-700 transition shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <span>🚀 [체험하기] AI 가상 타이핑 & 분석 시뮬레이션</span>
                    </button>
                  )}

                  {/* Cancel Button */}
                  <button
                    type="button"
                    onClick={() => setIsAiModalOpen(false)}
                    disabled={aiLoading}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-xl transition cursor-pointer text-center"
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : (
              /* Verification mode */
              <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto text-xs">
                <p className="text-toss-textSub">
                  추출 내역을 검토한 뒤 '데이터 일괄 등록'을 클릭해 저장하세요.
                </p>

                <div className="flex flex-col gap-3">
                  {parsedLectures.map((item, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 border border-toss-border rounded-2xl flex flex-col gap-3 relative">
                      <span className="absolute top-3 right-3 text-[9px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        강의 #{idx + 1}
                      </span>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-toss-textSub">교육장 / 기관명</label>
                        <input 
                          type="text"
                          value={item.institution}
                          onChange={(e) => handleParsedFieldChange(idx, 'institution', e.target.value)}
                          className="px-2.5 py-1.5 border border-toss-border rounded-lg bg-white font-bold focus:outline-none focus:border-toss-blue"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-toss-textSub">단가 (원)</label>
                          <input 
                            type="number"
                            value={item.rate}
                            onChange={(e) => handleParsedFieldChange(idx, 'rate', e.target.value)}
                            className="px-2 py-1.5 border border-toss-border rounded-lg bg-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-toss-textSub">시간 (차시)</label>
                          <input 
                            type="number"
                            value={item.classes}
                            onChange={(e) => handleParsedFieldChange(idx, 'classes', e.target.value)}
                            className="px-2 py-1.5 border border-toss-border rounded-lg bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-toss-textSub">교통비 (원)</label>
                          <input 
                            type="number"
                            value={item.transportFee}
                            onChange={(e) => handleParsedFieldChange(idx, 'transportFee', e.target.value)}
                            className="px-2 py-1.5 border border-toss-border rounded-lg bg-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-toss-textSub">날짜</label>
                          <input 
                            type="text"
                            value={item.date}
                            onChange={(e) => handleParsedFieldChange(idx, 'date', e.target.value)}
                            className="px-2 py-1.5 border border-toss-border rounded-lg bg-white focus:outline-none"
                          />
                        </div>
                      </div>


                      <div className="flex items-center justify-between border-t border-toss-border/60 pt-2 text-[10px]">
                        <label className="flex items-center gap-1 font-bold text-toss-textMuted cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={item.isPaid}
                            onChange={(e) => handleParsedFieldChange(idx, 'isPaid', e.target.checked)}
                            className="w-3.5 h-3.5"
                          />
                          이미 입금 완료됨
                        </label>
                        <span className="font-extrabold text-toss-textDark">예상수령: {formatWon(item.expectedAmount)}원</span>
                      </div>

                    </div>
                  ))}
                </div>

                <div className="flex gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAiVerifying(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-toss-textMuted font-bold rounded-xl w-full"
                  >
                    이전으로
                  </button>
                  {!isMockParseResult && (
                    <button
                      type="button"
                      onClick={handleSaveParsedLectures}
                      className="flex-1 py-2.5 bg-[#1F2E5B] hover:bg-[#172346] text-white font-bold rounded-xl shadow-md"
                    >
                      데이터 일괄 등록
                    </button>
                  )}
                </div>
                {isMockParseResult && (
                  <div className="text-center mt-2 text-[11.5px] font-bold text-indigo-650 bg-indigo-50/80 py-2.5 px-3 rounded-lg border border-indigo-100 leading-normal">
                    ※ 체험용 목업(가상) 데이터입니다. 본인의 실제 강의 내역을 정산하려면 <strong>[설정]</strong> 탭에서 <strong>Gemini API Key</strong>를 등록한 후 진짜 일정을 자동으로 분석해 보세요!
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================
          [MODAL 5]: Desktop API Settings Modal
         ======================================================== */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-fade">
          <div className="bg-white w-full max-w-md rounded-[28px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col modal-zoom-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Settings size={15} className="text-[#1E3A8A]" />
                대시보드 환경 설정 (PC)
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-xl transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5 text-xs overflow-y-auto">
              <div className="rounded-2xl p-5 bg-white border border-slate-200 shadow-sm flex flex-col gap-4">
                <span className="font-black text-[11.5px] text-[#1E3A8A] flex items-center gap-1.5"><Database size={14} /> API 및 클라우드 연동</span>
                
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-600">Gemini AI API Key</label>
                  {!isEditingApiKey && apiKey ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <span className="text-[11.5px] font-extrabold text-emerald-800">
                        🔒 API 키가 등록되었습니다.
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setIsEditingApiKey(true)} 
                        className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 font-black rounded-lg text-[10.5px] hover:bg-slate-50 transition active:scale-95 cursor-pointer shadow-sm"
                      >
                        변경
                      </button>
                    </div>
                  ) : (
                    <input type="password" id="settings-api-key-desktop" defaultValue={apiKey} placeholder="AIzaSy..." className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:outline-none focus:border-[#2563EB] placeholder-slate-400" />
                  )}
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="font-bold text-slate-600">구글 시트 웹 앱 URL <span className="text-[#EF4444] font-black text-[10px]">(반드시 배포된 *exec 주소)</span></label>
                    <button type="button" onClick={() => setIsScriptModalOpen(true)} className="text-[10px] font-black text-[#1E3A8A] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition cursor-pointer">연동 방법</button>
                  </div>
                  {!isEditingSheetUrl && sheetUrl ? (
                    <div className="flex flex-col gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 w-full">
                      <span className="text-[11.5px] font-extrabold text-emerald-800">
                        ☁️ 구글 시트 연동 주소(exec)가 등록되었습니다.
                      </span>
                      <div className="flex gap-2">
                        <a
                          href={`${sheetUrl}${sheetUrl.includes('?') ? '&' : '?'}open=true`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-[10.5px] shadow-sm transition active:scale-95 text-center no-underline cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span>📊 연동된 시트 확인하기</span>
                        </a>
                        <button 
                          type="button" 
                          onClick={() => setIsEditingSheetUrl(true)} 
                          className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 font-black rounded-lg text-[10.5px] hover:bg-slate-50 transition active:scale-95 cursor-pointer shadow-sm"
                        >
                          변경
                        </button>
                      </div>
                    </div>
                  ) : (
                    <input type="text" id="settings-sheet-url-desktop" defaultValue={sheetUrl} placeholder="예시주소: https://script.google.com/macros/s/.../exec" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:outline-none focus:border-[#2563EB] placeholder-slate-455" />
                  )}
                </div>
              </div>
              <div className="rounded-2xl p-4 bg-red-50 border border-red-200/60 flex flex-col gap-2">
                <span className="text-[11px] font-black text-red-700 flex items-center gap-1.5"><AlertCircle size={13} className="text-red-500" /> 기록 데이터 초기화</span>
                <button type="button" onClick={() => { if (window.confirm('정말 전체 초기화하시겠습니까? 등록된 모든 데이터가 삭제됩니다.')) { safeLocalStorage.clear(); setLectures([]); setApiKey(''); setSheetUrl(''); alert('초기화 완료. 새로고침합니다.'); window.location.reload(); } }} className="py-2 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-md transition text-[11px]">앱 전체 데이터 초기화</button>
              </div>
            </div>
            {sheetUrlError && (
              <div className="p-5 border-t border-slate-100 bg-white">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4.5 flex flex-col gap-2.5">
                  <p className="font-black text-amber-800 text-[12.5px] flex items-center gap-1.5">
                    ⚠️ 최초 연동을 위한 구글 권한 승인이 필요합니다
                  </p>
                  <p className="text-slate-600 font-semibold leading-relaxed text-[11px]">
                    구글의 보안 정책상, 최초 1회는 브라우저를 통해 웹 앱 사용 권한을 허용해 주셔야 대시보드 연동이 활성화됩니다.
                  </p>
                  <a
                    href={`${document.getElementById('settings-sheet-url-desktop')?.value || ''}${
                      (document.getElementById('settings-sheet-url-desktop')?.value || '').includes('?') ? '&' : '?'
                    }open=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-center text-[11.5px] no-underline block shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    🔑 구글 권한 승인 완료하기 (새 창)
                  </a>
                  <p className="text-slate-450 text-[10px] leading-normal font-medium mt-0.5">
                    ※ 위 버튼을 누르면 구글 권한 검토 화면이 열립니다. <br/>
                    <strong>[Review Permissions] (권한 검토) ➡️ [고급] ➡️ [이동] ➡️ [허용]</strong>을 완료해 주신 후, 다시 아래의 <strong>[설정 저장]</strong> 버튼을 눌러주세요.
                  </p>
                </div>
              </div>
            )}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button type="button" onClick={() => setIsSettingsOpen(false)} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-xl transition">닫기</button>
              <button type="button" onClick={() => { 
                const kEl = document.getElementById('settings-api-key-desktop'); 
                const uEl = document.getElementById('settings-sheet-url-desktop'); 
                const k = kEl ? kEl.value : apiKey; 
                const u = uEl ? uEl.value : sheetUrl; 
                if (k !== apiKey) {
                  safeLocalStorage.setItem('gemini_api_key', k);
                  setApiKey(k);
                }
                handleTestAndSaveSheetUrl(u, true);
              }} 
              disabled={isTestingSheetUrl}
              className="w-full py-2.5 bg-[#2563EB] text-white font-black rounded-xl shadow-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                {isTestingSheetUrl ? '연결 확인 중...' : '설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          [MODAL 4.5]: Apps Script & Device Sync Helper Modal
         ======================================================== */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-fade">
          <div className="bg-white w-full md:max-w-xl rounded-t-[32px] md:rounded-[28px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3 md:hidden flex-shrink-0" />
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5"><Database size={15} className="text-[#1E3A8A]" /> 구글 시트 실시간 연동 가이드</h3>
              <button onClick={() => setIsScriptModalOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-xl transition"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 text-slate-700">
              <div className="bg-blue-50 p-4.5 rounded-2xl border border-blue-100 flex flex-col gap-2">
                <p className="font-black text-[#1E3A8A] text-[13px] flex items-center gap-1.5">⚡ 기기 간 실시간 자동 동기화</p>
                <p className="text-slate-600 font-semibold leading-relaxed text-[11.5px]">
                  구글 스프레드시트를 연동하시면 PC, 스마트폰, 태블릿 등 여러 기기에서 백업/다운로드 버튼 조작 없이 **실시간으로 데이터가 자동 동기화**됩니다.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <h4 className="font-black text-sm text-[#0F172A] flex items-center gap-1">🛠️ 구글 시트 연동 순서 (7단계)</h4>
                <ol className="list-decimal pl-5 flex flex-col gap-3.5 text-slate-600 font-bold leading-relaxed text-[12px]">
                  <li>
                    <strong className="text-slate-800">구글 시트 개설</strong>: 
                    <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:text-blue-800 underline font-black ml-1">
                      새 문서 만들기 ↗
                    </a>
                    <span className="block mt-1.5 text-emerald-600 font-black bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                      💡 기존에 관리하시던 강의 장부 데이터가 있으신가요?<br/>
                      <span className="text-slate-500 font-medium">연동하기 전에 먼저 [데이터 백업 및 가져오기] 메뉴에서 AI 변환 프롬프트로 생성한 CSV 데이터를 대시보드에 업로드하거나, 구글 시트 메뉴 [파일] ➡️ [가져오기]를 통해 기존 데이터를 시트에 채워두고 진행해 주세요!</span>
                    </span>
                  </li>
                  <li>
                    <strong className="text-slate-800">시트 [공유] 범위 설정</strong>: 구글 시트 우측 상단의 <strong>[공유]</strong> 버튼을 누르고 일반 액세스를 <strong className="text-blue-600 underline font-black">"링크가 있는 모든 사용자 (뷰어)"</strong>로 변경해 줍니다.
                    <span className="block mt-1 text-slate-500 font-medium leading-normal">※ 참고: 대시보드의 실시간 연동은 4번 단계의 웹 앱 실행 권한(나)에 의해 처리되므로, 시트를 <strong>'뷰어'</strong>로만 열어두셔도 동기화는 정상 작동합니다.</span>
                  </li>
                  <li>스프레드시트 상단 메뉴의 <strong>[확장 프로그램] ➡️ [Apps Script]</strong>를 클릭합니다.</li>
                  <li>편집기에 있는 기존 예제 코드를 모두 지운 뒤, 아래의 템플릿 코드를 복사하여 붙여넣고 상단의 <strong>[저장] (또는 Ctrl+S)</strong>을 클릭합니다.</li>
                  <li>
                    우측 상단 <strong>[배포] ➡️ [새 배포]</strong> 버튼을 클릭합니다.
                    <ul className="list-disc pl-4 mt-1.5 text-slate-500 flex flex-col gap-1 font-medium">
                      <li>유형: <strong>"웹 앱"</strong> 선택</li>
                      <li>웹 앱 실행 대상: <strong>"나"</strong> 선택</li>
                      <li>액세스 권한: <strong className="text-[#EF4444] font-black underline">"모든 사용자" (Anyone)</strong> 선택 후 배포를 클릭합니다.</li>
                    </ul>
                  </li>
                  <li>
                    <strong className="text-slate-800 text-blue-600 flex items-center gap-1">🔑 액세스 승인 및 보안 경고 우회</strong>:
                    <span className="block mt-1 text-slate-600">
                      배포를 클릭하면 권한 부여를 위한 <strong>[액세스 승인] (Authorize Access)</strong> 팝업이 뜹니다. 본인의 구글 계정을 선택해 줍니다.
                    </span>
                    <span className="block mt-1.5 text-amber-600 font-black bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                      ⚠️ 구글 보안 경고("Google hasn't verified this app" 또는 "Google에서 이 앱을 검증하지 않았습니다") 화면이 나오는 경우:<br/>
                      <span className="text-slate-500 font-medium leading-normal">
                        1. 화면 좌측 하단의 <strong>[고급] (Advanced)</strong> 글자를 클릭합니다.<br/>
                        2. 펼쳐진 설명 최하단의 <strong className="underline text-red-600">"[제목 없는 프로젝트(으)로 이동 (unsafe)]" (Go to Untitled project (unsafe))</strong> 링크를 클릭합니다.<br/>
                        3. 마지막 화면에서 <strong>[허용] (Allow)</strong> 버튼을 클릭합니다.
                      </span>
                    </span>
                  </li>
                  <li>
                    배포 완료 후 화면에 표시되는 **웹 앱 URL**을 복사해 설정창에 저장합니다.
                    <span className="block mt-1 text-[#EF4444] font-black text-[11.5px]">※ 필수 확인: 복사한 주소 끝부분이 반드시 `/exec`로 끝나는 주소여야 합니다!</span>
                  </li>
                </ol>
              </div>

              <div className="bg-slate-900 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-black text-[11px] text-sky-400">Apps Script 템플릿 코드</span>
                  <button onClick={() => { copyToClipboard(gasTemplateCode, () => { setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }); }} className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black flex items-center gap-1.5 transition">
                    <Copy size={11} />{copiedCode ? '복사 완료!' : '전체 복사'}
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 text-indigo-200 rounded-xl overflow-x-auto text-[10px] font-mono leading-relaxed max-h-[160px] overflow-y-auto">{gasTemplateCode}</pre>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setIsScriptModalOpen(false)} className="w-full py-3 bg-[#1E3A8A] text-white font-black rounded-xl text-xs hover:bg-[#0F172A] transition">가이드 읽기 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          [MODAL 7]: Calendar Date Details Bottom Sheet
         ======================================================== */}
      {selectedCalendarDate && (
        <div className="fixed inset-0 flex items-end justify-center p-0 z-50 backdrop-blur-fade md:hidden">
          {/* Bottom Sheet wrapper */}
          <div className="bg-[#F8FAFC] w-full rounded-t-[32px] max-h-[75vh] flex flex-col pb-8 shadow-2xl bottom-sheet-enter overflow-hidden">
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 flex-shrink-0" />
            
            {/* Header */}
            <div className="px-5 pb-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-[#2563EB] uppercase tracking-wider">출강 현황 조회</span>
                <h3 className="text-sm font-black text-slate-800">{selectedCalendarDate} 강의 명세</h3>
              </div>
              <button 
                onClick={() => setSelectedCalendarDate(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Body - Lecture items list */}
            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto">
              {lectures.filter(l => matchesCalendarDate(l.date, selectedCalendarDate)).map((l) => (
                <div 
                  key={l.id} 
                  className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col gap-2 relative"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-extrabold text-slate-800 text-xs">{l.institution}</h4>
                        <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded border ${
                          l.role === 'Assistant' 
                            ? 'text-slate-500 bg-slate-50 border-slate-200' 
                            : 'text-blue-600 bg-blue-50/50 border-blue-200'
                        }`}>
                          {l.role === 'Assistant' ? '보조강사' : '주강사'}
                        </span>
                      </div>
                      <p className="text-[9.5px] text-slate-400 mt-1">단가 {formatWon(l.rate)}원 × {l.classes}차시</p>
                    </div>
                    <div
                      className="text-[9.5px] font-black px-2.5 py-1 rounded-xl"
                      style={l.isPaid
                        ? {background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981'}
                        : {background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.20)', color: '#64748B'}
                      }
                    >
                      {l.isPaid ? '✓ 완료' : '⏳ 대기'}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-dashed border-slate-100">
                    <span className="text-[9.5px] text-slate-400">실수령액:</span>
                    <strong className="text-xs font-black text-slate-800">
                      {l.isPaid ? formatWon(l.netAmount) : formatWon(l.expectedAmount)}원
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          [MODAL 6]: Tax Receipt Modal (Premium torn paper look)
         ======================================================== */}

      {receiptItem && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 backdrop-blur-fade">
          {/* Torn Receipt Card */}
          <div className="bg-white w-full max-w-sm rounded-t-2xl shadow-2xl relative overflow-hidden flex flex-col modal-zoom-in">
            {/* Header pattern */}
            <div className="h-2 bg-[#00BCD4] w-full" />
            
            <div className="p-6 flex flex-col gap-4 text-xs font-mono text-slate-800">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <span className="text-[10px] text-toss-textSub font-bold tracking-wider">강의정산 BILLING SERVICE</span>
                <h3 className="text-base font-black text-slate-900 mt-0.5">{receiptItem.institution}</h3>
                <span className="text-[9px] text-slate-400 block mt-1">{receiptItem.month} · {receiptItem.date} 출강건</span>
              </div>
              
              {/* Billing Info */}
              <div className="flex flex-col gap-2 py-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">기본 강의료:</span>
                  <span className="font-bold text-slate-900">{formatWon(receiptItem.rate * receiptItem.classes)}원</span>
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between pl-3">
                  <span>({formatWon(receiptItem.rate)}원 × {receiptItem.classes}시간)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">추가 교통비:</span>
                  <span className="font-bold text-slate-900">{formatWon(receiptItem.transportFee)}원</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-extrabold text-slate-900">
                  <span>합계 총액:</span>
                  <span>{formatWon(receiptItem.expectedAmount)}원</span>
                </div>
              </div>

              {/* Tax Deduction Details */}
              <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>공제 세율 ({receiptItem.taxRate}):</span>
                  <span>- {formatWon(receiptItem.expectedAmount - receiptItem.netAmount)}원</span>
                </div>
                {receiptItem.taxRate !== 'None' && (
                  <div className="flex flex-col gap-1 text-[10px] text-slate-500 pl-2 mt-1 border-l border-slate-200">
                    <div className="flex justify-between">
                      <span>소득세 (원천세):</span>
                      <span>{formatWon(Math.floor((receiptItem.expectedAmount - receiptItem.netAmount) * 0.909))}원</span>
                    </div>
                    <div className="flex justify-between">
                      <span>지방소득세 (주민세):</span>
                      <span>{formatWon(Math.floor((receiptItem.expectedAmount - receiptItem.netAmount) * 0.091))}원</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Net Amount Receipt */}
              <div className="text-center pt-3 pb-1 border-t border-dashed border-slate-300">
                <span className="text-[10px] text-slate-400 block font-bold">실 수 령 액</span>
                <span className="text-2xl font-black text-[#10B981] tracking-tight block mt-1">
                  {formatWon(receiptItem.netAmount)}원
                </span>
              </div>

              {/* Decorative Barcode */}
              <div className="flex flex-col items-center gap-1 mt-1 opacity-70">
                <div className="h-8 w-44 bg-slate-800" style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, #1e293b, #1e293b 2px, transparent 2px, transparent 6px, #1e293b 6px, #1e293b 7px, transparent 7px, transparent 10px)'
                }} />
                <span className="text-[8px] text-slate-400">강의정산-VERIFIED-TAX-RECEIPT</span>
              </div>
            </div>
            
            {/* Torn Zigzag bottom border */}
            <div className="h-4 w-full bg-white relative z-20" style={{
              backgroundImage: 'linear-gradient(-45deg, transparent 4px, white 4px), linear-gradient(45deg, transparent 4px, white 4px)',
              backgroundSize: '8px 12px',
              backgroundPosition: 'left bottom',
              transform: 'translateY(-2px)'
            }} />

            {/* Back to billing list button */}
            <div className="px-5 pb-5">
              <button 
                type="button" 
                onClick={() => setReceiptItem(null)} 
                className="w-full py-3 bg-[#1F2E5B] hover:bg-[#172346] text-white font-extrabold text-xs rounded-xl shadow-lg btn-press flex items-center justify-center gap-1.5"
              >
                영수증 닫기
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 완료 처리 시 축하 Lottie overlay */}
      {showMoneyLottie && (
        <div className={`fixed inset-0 flex items-center justify-center z-[100] pointer-events-none transition-opacity duration-500 ${lottieFade ? 'opacity-0' : 'opacity-100'}`}>
          <div className="fixed inset-0 bg-[#0F172A]/35 backdrop-blur-[4px] transition-all" />
          <div className="flex flex-col items-center justify-center z-10 scale-up-bounce pointer-events-auto">
            <StableLottie 
              path="/lottie/Money stack.json" 
              className="w-48 h-48 drop-shadow-2xl"
              loop={false}
            />
            <span className="text-[20px] font-black text-yellow-300 mt-4 block animate-pulse drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] text-center">
              정산 완료 처리가 되었습니다! 💸
            </span>
            <span className="text-[13px] font-black text-slate-200 mt-1.5 block drop-shadow-[0_1px_5px_rgba(0,0,0,0.5)] text-center">
              오늘도 정말 수고 많으셨습니다! 👏
            </span>
          </div>
        </div>
      )}

      {/* 실수령액 직접 편집 모달 */}
      {isNetEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-fade">
          <div className="bg-white w-full max-w-sm rounded-[24px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col modal-zoom-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                💰 최종 정산액 수정
              </h3>
              <button onClick={() => setIsNetEditModalOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-xl transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="text-[11.5px] text-slate-500 font-semibold leading-relaxed">
                이 강의의 최종 실수령 금액만 변경합니다. 기본 정보(단가, 차시)는 고정되며, 덮어쓴 금액이 통계와 전체 로직에 동일하게 반영됩니다.
              </p>
              <div className="flex flex-col gap-2">
                <label className="text-[12.5px] font-black text-slate-600">실 수령 금액 (원)</label>
                <input 
                  type="number" 
                  value={editingNetValue} 
                  onChange={(e) => setEditingNetValue(e.target.value)} 
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-[15px] font-bold focus:outline-none focus:border-[#2563EB] bg-[#F8FAFC] text-slate-800" 
                  placeholder="금액 입력"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button type="button" onClick={() => setIsNetEditModalOpen(false)} className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold rounded-xl transition text-[13px]">취소</button>
              <button 
                type="button" 
                onClick={() => {
                  setLectures(prev => prev.map(item => item.id === editingNetCardId ? { ...item, netAmount: Number(editingNetValue) } : item));
                  setIsNetEditModalOpen(false);
                }} 
                className="w-full py-3 bg-[#2563EB] text-white font-black rounded-xl shadow-md hover:bg-blue-700 transition text-[13px]"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── [MODAL 8]: 최초 안내 공지사항 모달 (홈 화면 추가 권장) ── */}
      {isNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative flex flex-col items-center p-6 border border-slate-200/80">
            {/* Close Button X */}
            <button
              onClick={handleCloseNotice}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition border-none bg-transparent cursor-pointer animate-fade-in flex items-center justify-center"
              aria-label="닫기"
            >
              <X size={18} />
            </button>

            {/* Logo: Coin Lottie (no bg container, centered) */}
            <div className="my-3 flex items-center justify-center relative">
              <div className="absolute w-24 h-24 bg-blue-500/10 blur-2xl rounded-full pointer-events-none" />
              <StableLottie path="/lottie/Fake 3D vector coin.json" className="w-[88px] h-[88px] relative z-10" />
            </div>

            {/* Title */}
            <h3 className="text-[#0F172A] text-[22px] font-black tracking-tight mt-2 text-center">
              출강바이브
            </h3>

            {/* Description */}
            <div className="text-center mt-3 px-1 flex flex-col gap-1 text-[13.5px] text-slate-500 font-semibold leading-relaxed">
              <p>홈 화면에 추가하고</p>
              <p>매일 편리하게 출강 현황을 관리해 보세요.</p>
            </div>

            {/* Guidance Content Card */}
            <div className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-3.5 mt-5 shadow-sm">
              <p className="text-[11.5px] text-slate-500 font-medium leading-relaxed text-center">
                클라우드 실시간 동기를 연동하지 않는 경우, 브라우저마다 데이터가 개별 저장되거나 초기화될 위험이 있습니다.
              </p>

              {/* CTA Instruction - High Contrast Blue Theme */}
              <div className="bg-blue-50 rounded-xl p-3.5 flex flex-col gap-1.5 items-center justify-center border border-blue-100/85 shadow-sm">
                <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#2563EB]">
                  <span className="text-xs">📤</span>
                  <span>[공유] 버튼을 누른 뒤</span>
                </div>
                <div className="text-[10px] text-blue-400 font-black">⬇️</div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#2563EB] text-white text-[10px] font-extrabold px-3 py-1.5 rounded-lg shadow-sm">
                    홈 화면에 추가
                  </span>
                  <span className="text-[12px] font-extrabold text-slate-700">누르면 끝!</span>
                </div>
              </div>

              <p className="text-[10.5px] text-slate-400 font-bold leading-relaxed text-center">
                ※ 안전한 기기 간 실시간 자동 동기화를 위해
                <span className="block mt-1 text-[#2563EB] font-black">👉 [설정 ➡️ 클라우드 실시간 동기] 사용을 강력하게 권장합니다.</span>
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="w-full flex items-center justify-between mt-6 border-t border-slate-100 pt-4 px-1">
              <button
                onClick={handleHide7Days}
                className="text-slate-400 hover:text-slate-600 text-[11.5px] font-bold underline transition border-none bg-transparent cursor-pointer"
              >
                7일간 보지 않기
              </button>
              <button
                onClick={handleCloseNotice}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12.5px] font-black px-6 py-2.5 rounded-xl transition shadow-md border-none active:scale-95 min-w-[110px] text-center cursor-pointer"
              >
                지금 보러가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Month Picker Modal */}
      {isMonthPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-fade">
          <div className="bg-white w-full max-w-xs rounded-[28px] shadow-2xl p-6 flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14.5px] font-black text-slate-800 flex items-center gap-1.5">
                📅 {statsYear}년 월 선택
              </h3>
              <button 
                onClick={() => setIsMonthPickerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-650 hover:bg-slate-50 rounded-lg transition border-none bg-transparent cursor-pointer flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto py-1">
              {activeYearMonths.map(m => {
                const isSelected = selectedMonth === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSelectedMonth(m);
                      setIsMonthPickerOpen(false);
                    }}
                    className={`py-2 text-[12px] font-black rounded-xl transition active:scale-95 cursor-pointer text-center ${
                      isSelected
                        ? 'bg-[#1F2E5B] text-white shadow-sm shadow-blue-900/10'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/45'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            
            <div className="border-t border-slate-100 pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth('All');
                  setIsMonthPickerOpen(false);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl text-[11.5px] transition cursor-pointer text-center border-none"
              >
                전체 선택 (All)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ── */}


    </div>
  );
}