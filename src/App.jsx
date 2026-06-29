import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Calendar, TrendingUp, AlertCircle, 
  CheckCircle2, X, Download, Upload, Trash2, Edit3, Check, Info,
  Settings, Sparkles, Database, RefreshCw, Home, BarChart, 
   BookOpen, Copy, Cloud
} from 'lucide-react';
import { INITIAL_LECTURES } from './initialData';
import StableLottie from './components/StableLottie';



// 통화(원화) 안전 포맷터
function formatWon(val) {
  return (Number(val) || 0).toLocaleString();
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

// ── React Bits: Spotlight Card Mouse Move Handler ──
const handleCardMouseMove = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
  e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
};

export default function App() {

  // 모바일 앱용 탭 상태 ('home', 'stats', 'sync', 'settings')
  const [activeTab, setActiveTab] = useState('home');
  const [prevTab, setPrevTab] = useState(null); // for slide direction

  // 자주 쓰는 프리셋 데이터 상태 (이모지 제거, 역할[role] 필드 보강)
  const [presets, setPresets] = useState(() => {
    const saved = safeLocalStorage.getItem('lectoss_presets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: 'p1', name: '디지털새싹 코딩교실', role: 'Main', rate: 50000, classes: 4, transportFee: 50000, taxRate: '3.3%' },
      { id: 'p2', name: '디지털배움터 스마트폰', role: 'Assistant', rate: 35000, classes: 6, transportFee: 20000, taxRate: '3.3%' },
      { id: 'p3', name: '주민센터 스마트교실', role: 'Main', rate: 100000, classes: 2, transportFee: 0, taxRate: '8.8%' },
      { id: 'p4', name: '역량강화 기업교육', role: 'Main', rate: 150000, classes: 3, transportFee: 30000, taxRate: '8.8%' },
      { id: 'p5', name: '디지털새싹 진로특강', role: 'Assistant', rate: 50000, classes: 6, transportFee: 84000, taxRate: '3.3%' }
    ];
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
      date: prev.date || `${new Date().getMonth() + 1}월 ${new Date().getDate()}일`
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
    setCalTouchStart(e.touches[0].clientX);
  };
  const handleCalTouchEnd = (e) => {
    if (calTouchStart === null) return;
    const diff = e.changedTouches[0].clientX - calTouchStart;
    if (diff > 60) {
      handlePrevMonth(); // 오른쪽으로 드래그 -> 이전 달
    } else if (diff < -60) {
      handleNextMonth(); // 왼쪽으로 드래그 -> 다음 달
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







  // Tab order for slide direction
  const TAB_ORDER = ['home', 'calendar', 'stats', 'sync', 'settings'];
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

  // 강의 데이터 상태
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  
  // 모달 제어
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLecture, setEditingLecture] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMockParseResult, setIsMockParseResult] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [activeMenuCardId, setActiveMenuCardId] = useState(null);



  // AI 및 설정 관련 상태
  const [apiKey, setApiKey] = useState(() => safeLocalStorage.getItem('gemini_api_key') || '');
  const [sheetUrl, setSheetUrl] = useState(() => safeLocalStorage.getItem('google_sheet_url') || '');
  const [copiedCode, setCopiedCode] = useState(false);
  
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
    date: '',
    registrationDate: new Date().toISOString().slice(0, 10),
    isPaid: false,
    taxRate: '8.8%',
    taxBase: 'LectureOnly',
    customTax: 0
  });

  // 로컬 스토리지 데이터 동기화
  useEffect(() => {
    safeLocalStorage.setItem('lectures', JSON.stringify(lectures));
  }, [lectures]);

  // Reset card swipe offsets on filter or search changes to prevent rendering anomalies (Placed safely below state initialization)
  useEffect(() => {
    setSwipeActiveId(null);
    setTouchOffset(0);
  }, [searchQuery, selectedMonth]);

  // 최초 로드 시 시트 연동 되어있으면 백그라운드 데이터 풀
  useEffect(() => {
    if (sheetUrl && lectures.length === 0) {
      fetchFromGoogleSheetSilent();
    }
  }, [sheetUrl]);

  // 자동 완성 추천 목록
  const uniqueInstitutions = Array.from(new Set(lectures.map(l => l?.institution).filter(Boolean)));

  // 고유 월 리스트 정렬
  const monthOrder = [
    '25/10월', '25/11월', '25/12월', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'
  ];
  const extractMonth = (dateStr) => {
    if (!dateStr) return '';
    const m = dateStr.match(/(\d+)월/);
    return m ? `${m[1]}월` : '';
  };

  const uniqueMonths = Array.from(new Set(lectures.map(l => extractMonth(l?.date)).filter(Boolean))).sort((a, b) => {
    const indexA = monthOrder.indexOf(a);
    const indexB = monthOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return (a || '').localeCompare(b || '');
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // 세금 계산식
  const calculateFees = (rate, classes, transport, taxRate, taxBase, customTax, isPaid) => {
    const lectureFee = rate * classes;
    const expectedAmount = lectureFee + transport;
    
    if (!isPaid) {
      return { expectedAmount, deduction: 0, netAmount: 0 };
    }

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
  const handleSaveSettings = (geminiKey, sheetApiUrl) => {
    safeLocalStorage.setItem('gemini_api_key', geminiKey);
    safeLocalStorage.setItem('google_sheet_url', sheetApiUrl);
    setApiKey(geminiKey);
    setSheetUrl(sheetApiUrl);
    alert('설정이 저장되었습니다.');
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
    setAiText(`[출강 공지]
디지털새싹 정보화교육 안내
1. 11/19(화) 09:00~12:00 (3차시) - 광주사회복지회관 (한국사회복지협의회 DX 교육)
- 단가: 100,000원, 교통비: 20,000원

2. 11/24(일) 14:00~16:00 (2차시) - 해남종합사회복지관
- 단가: 100,000원 (교통비 없음)`);
    
    setAiLoading(true);
    setAiError(null);

    setTimeout(() => {
      const mockParsed = [
        {
          id: `mock-${Date.now()}-1`,
          institution: '사회복지협의회/광주사회복지회관',
          rate: 100000,
          classes: 3,
          transportFee: 20000,
          expectedAmount: 320000,
          deduction: -26400,
          netAmount: 293600,
          month: '11월',
          date: '11월 19일',
          registrationDate: new Date().toISOString().slice(0, 10),
          isPaid: false,
          taxRate: '8.8%',
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
          deduction: -17600,
          netAmount: 182400,
          month: '11월',
          date: '11월 24일',
          registrationDate: new Date().toISOString().slice(0, 10),
          isPaid: false,
          taxRate: '8.8%',
          taxBase: 'LectureOnly',
          customTax: 0
        }
      ];
      setParsedLectures(mockParsed);
      setIsAiVerifying(true);
      setIsMockParseResult(true);
      setAiLoading(false);
    }, 1000);
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
            item.taxRate || '8.8%',
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
            taxRate: item.taxRate || '8.8%',
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
      if (Array.isArray(data)) {
        const mapped = data.map(row => ({
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
          registrationDate: String(row.registrationDate || new Date().toISOString().slice(0, 10)),
          isPaid: String(row.isPaid) === 'true' || row.isPaid === true,
          taxRate: String(row.taxRate || '8.8%'),
          taxBase: String(row.taxBase || 'LectureOnly'),
          customTax: Number(row.customTax) || 0
        }));
        setLectures(mapped);
        setSyncMessage({ type: 'success', text: `구글 시트에서 ${mapped.length}개의 강의 내역을 동기화하여 가져왔습니다.` });
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
        if (Array.isArray(data)) {
          const mapped = data.map(row => ({
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
            registrationDate: String(row.registrationDate),
            isPaid: String(row.isPaid) === 'true' || row.isPaid === true,
            taxRate: String(row.taxRate),
            taxBase: String(row.taxBase || 'LectureOnly'),
            customTax: Number(row.customTax) || 0
          }));
          setLectures(mapped);
        }
      }
    } catch (e) {
      console.warn('Silent sync failed', e);
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
      date: '',
      registrationDate: new Date().toISOString().slice(0, 10),
      isPaid: false,
      taxRate: '8.8%',
      taxBase: 'LectureOnly',
      customTax: 0
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
      taxRate: formData.taxRate || '8.8%'
    };
    setPresets(prev => [...prev, newPreset]);
    alert('즐겨찾기 목록에 저장되었습니다.');
  };

  // 정산 여부 토글
  const handleTogglePaid = (lecture) => {
    const nextPaid = !lecture.isPaid;
    const { expectedAmount, deduction, netAmount } = calculateFees(
      lecture.rate,
      lecture.classes,
      lecture.transportFee,
      lecture.taxRate || '8.8%',
      lecture.taxBase || 'LectureOnly',
      lecture.customTax || 0,
      nextPaid
    );

    const updatedList = lectures.map(l => {
      if (l.id === lecture.id) {
        return { ...l, isPaid: nextPaid, deduction, netAmount };
      }
      return l;
    });

    setLectures(updatedList);
  };

  // 삭제
  const handleDelete = (id) => {
    if (window.confirm('정말 이 기록을 삭제하시겠습니까?')) {
      const updatedList = lectures.filter(l => l.id !== id);
      setLectures(updatedList);
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
      taxRate: lecture.taxRate || '8.8%',
      taxBase: lecture.taxBase || 'LectureOnly',
      customTax: lecture.customTax || 0
    });

    setIsAddModalOpen(true);
  };

  // CSV 내보내기
  const handleExportCSV = () => {
    const headers = ['기관명/학교', '출강역할', '강의단가', '총 차시', '예상수령액', '교통비(+)', '공제금액(-)', '월', '실수령액', '날짜', '등록일', '정산여부'];
    const rows = lectures.map(l => [
      l.institution,
      l.role === 'Assistant' ? '보조강사' : '주강사',
      l.rate,
      l.classes,
      l.expectedAmount,
      l.transportFee || '',
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

  // CSV 가져오기
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      if (lines.length < 2) return;

      const newLectures = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        const cleanFields = matches.map(f => f.replace(/^"|"$/g, '').trim());

        if (cleanFields.length < 8) continue;

        const inst = cleanFields[0];
        const role = cleanFields[1] === '보조강사' ? 'Assistant' : 'Main';
        const rate = Number(cleanFields[2]) || 0;
        const classes = Number(cleanFields[3]) || 0;
        const expected = Number(cleanFields[4]) || 0;
        const transport = Number(cleanFields[5]) || 0;
        const deduction = Number(cleanFields[6]) || 0;
        const month = cleanFields[7];
        const net = cleanFields[8] ? Number(cleanFields[8]) : 0;
        const date = cleanFields[9] || '';
        const regDate = cleanFields[10] || new Date().toISOString().slice(0, 10);
        const isPaid = cleanFields[11] === '정산완료' || net > 0;

        newLectures.push({
          id: `csv-${Date.now()}-${i}`,
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
          taxRate: deduction !== 0 ? 'Custom' : 'None',
          taxBase: 'LectureOnly',
          customTax: Math.abs(deduction)
        });
      }

      if (newLectures.length > 0) {
        if (window.confirm(`CSV 파일에서 ${newLectures.length}개의 출강 이력을 가져옵니다. 병합하시겠습니까?`)) {
          setLectures(prev => [...newLectures, ...prev]);
        }
      }
    };
    reader.readAsText(file);
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
          handleImportCSV(e);
        }, 450);
      }
      setUploadProgress(progress);
    }, 40);
  };


  // 통계 계산
  const totalExpected = lectures.reduce((acc, curr) => acc + curr.expectedAmount, 0);
  const totalNet = lectures.reduce((acc, curr) => acc + curr.netAmount, 0);
  const totalUnpaid = lectures.reduce((acc, curr) => acc + (curr.isPaid ? 0 : curr.expectedAmount), 0);
  const unpaidCount = lectures.filter(l => !l.isPaid).length;

  // 차트 집계
  const chartData = uniqueMonths.map(m => {
    const monthItems = lectures.filter(l => extractMonth(l.date) === m);
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

  const filteredLectures = lectures.filter(l => {
    if (!l) return false;
    const inst = l.institution || '';
    const matchesSearch = inst.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMonth = selectedMonth === 'All' || extractMonth(l.date) === selectedMonth;
    const matchesStatus = 
      selectedStatus === 'All' || 
      (selectedStatus === 'Paid' && l.isPaid) || 
      (selectedStatus === 'Pending' && !l.isPaid);
    
    return matchesSearch && matchesMonth && matchesStatus;
  });

  const gasTemplateCode = `function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      row[headers[j]] = val;
    }
    rows.push(row);
  }
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var payload = JSON.parse(e.postData.contents);
  var action = payload.action;
  
  if (action === "sync_all") {
    sheet.clearContents();
    var headers = ["id", "institution", "rate", "classes", "expectedAmount", "transportFee", "deduction", "netAmount", "month", "date", "registrationDate", "isPaid", "taxRate", "taxBase", "customTax"];
    sheet.appendRow(headers);
    
    if (payload.lectures && payload.lectures.length > 0) {
      payload.lectures.forEach(function(l) {
        sheet.appendRow([
          l.id, l.institution, Number(l.rate) || 0, Number(l.classes) || 0, Number(l.expectedAmount) || 0,
          Number(l.transportFee) || 0, Number(l.deduction) || 0, Number(l.netAmount) || 0, l.month, l.date,
          l.registrationDate, l.isPaid, l.taxRate, l.taxBase, Number(l.customTax) || 0
        ]);
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", count: payload.lectures.length }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <div className="min-h-screen bg-[#F8FAF8] text-[#1F2E5B] font-sans antialiased" style={{fontFamily: "'Pretendard', 'Inter', sans-serif"}}>
      <svg className="absolute w-0 h-0" width="0" height="0">
        <defs>
          <pattern id="unpaid-stripes" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <rect width="6" height="12" fill="rgba(31, 46, 91, 0.08)" />
            <rect x="6" width="6" height="12" fill="rgba(31, 46, 91, 0.22)" />
          </pattern>
        </defs>
      </svg>

      {/* ========================================================
          [MOBILE SCREEN VIEW] - Renders on mobile screens (< 768px)
         ======================================================== */}
      <div className="flex md:hidden flex-col min-h-screen pb-32">
        {/* App Title Header — Clean White Theme */}
        <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              {/* 3D Coin Lottie Logo */}
              <StableLottie path="/lottie/Fake 3D vector coin.json" className="w-[32px] h-[32px] drop-shadow-sm flex-shrink-0" />
              <div>
                <h1 className="text-[#0F172A] text-[16px] font-black tracking-tight" style={{lineHeight: 1.15}}>
                  정산비서
                </h1>
                <p className="text-[10px] text-[#94A3B8] font-bold tracking-wider uppercase">출강 관리 비서</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* AI Button - Kept functionally, but visually integrated into sub-toolbar */}
              <button 
                onClick={() => {
                  setAiText('');
                  setAiError(null);
                  setParsedLectures([]);
                  setIsAiVerifying(false);
                  setIsAiModalOpen(true);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 transition hover:bg-slate-50 rounded-xl border border-slate-100 bg-white"
                title="AI 일정 등록"
              >
                <Sparkles size={13} />
              </button>
              <button 
                onClick={() => {
                  setEditingLecture(null);
                  setFormData({
                    institution: '',
                    role: 'Main',
                    rate: 100000,
                    classes: 4,
                    transportFee: 0,
                    month: getNextMonthString(),
                    date: '',
                    registrationDate: new Date().toISOString().slice(0, 10),
                    isPaid: false,
                    taxRate: '8.8%',
                    taxBase: 'LectureOnly',
                    customTax: 0
                  });
                  setIsAddModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center gap-1 shadow-sm transition-all text-[11px]"
                title="강의 추가"
              >
                <Plus size={12} />
                <span>기록</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Tab Body — motion: slide direction from prevTab */}
        <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto pb-24">
          {/* invisible motion key — forces re-mount on tab change for animation */}
          
          {/* TAB 1: HOME (Lectures Card List) */}
          {activeTab === 'home' && (
            <div key="tab-home" className={`${getSlideClass()} flex flex-col gap-4`}>
              
              {/* 모바일 2분할 슬림 요약 위젯 */}
              <div className="grid grid-cols-2 gap-3 animate-fade-in">
                {/* 대기 위젯 */}
                <div 
                  className="rounded-[20px] p-4 bg-white border border-slate-200/60 flex flex-col gap-1 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-12 h-12 rounded-full bg-blue-50/50 opacity-40 translate-x-2 -translate-y-2" />
                  <span className="text-[12px] font-black text-slate-400">정산 대기</span>
                  <span className="text-lg font-black text-slate-800 tracking-tight">
                    ₩{formatWon(totalUnpaid)}
                  </span>
                  <div className="text-[11px] text-slate-500 font-bold mt-0.5">
                    총 {unpaidCount}건 대기 중
                  </div>
                </div>

                {/* 완료 위젯 */}
                <div 
                  className="rounded-[20px] p-4 bg-white border border-slate-200/60 flex flex-col gap-1 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-12 h-12 rounded-full bg-emerald-50/50 opacity-40 translate-x-2 -translate-y-2" />
                  <span className="text-[12px] font-black text-slate-400">정산 완료</span>
                  <span className="text-lg font-black text-emerald-600 tracking-tight">
                    ₩{formatWon(totalNet)}
                  </span>
                  <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
                    총 {lectures.filter(l=>l.isPaid).length}건 완료
                  </div>
                </div>
              </div>



              {/* Filters Box */}

              <div className="bg-white p-3 rounded-[20px] border border-toss-border shadow-sm flex flex-col gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 text-toss-textSub" size={15} />
                  <input 
                    type="text" 
                    placeholder="교육 기관명 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-toss-border rounded-xl text-[13px] font-medium bg-[#F8FAF8]"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-none">
                  <button 
                    onClick={() => setSelectedMonth('All')}
                    className={`text-[11px] font-black px-3 py-1.5 rounded-lg ${selectedMonth === 'All' ? 'bg-[#1F2E5B] text-white' : 'bg-gray-100 text-toss-textSub'}`}
                  >
                    전체 월
                  </button>
                  {uniqueMonths.map((m, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setSelectedMonth(m)}
                      className={`text-[11px] font-black px-3 py-1.5 rounded-lg ${selectedMonth === m ? 'bg-[#1F2E5B] text-white' : 'bg-gray-100 text-toss-textSub'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card List */}
              {filteredLectures.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <Calendar size={36} className="text-toss-textSub mb-2" />
                  <span className="text-xs font-bold text-toss-textDark">기록된 출강 건이 없습니다.</span>
                  <p className="text-[10px] text-toss-textSub mt-1">상단의 + 단추나 AI 스캔 단추를 눌러 시작해 보세요.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredLectures.map((l, idx) => {
                    return (
                      <div
                        key={l.id}
                        className="relative overflow-hidden rounded-[22px]"
                        style={{border:'1px solid rgba(31,46,91,0.10)',boxShadow:'0 2px 12px rgba(31,46,91,0.06)'}}
                      >
                        <div className="card-hover bg-white flex flex-col relative" style={{animationDelay:(idx*55)+'ms',padding:'18px'}}>
                          {l.isPaid && (
                            <div className="absolute -bottom-2 -right-4 opacity-40 pointer-events-none" style={{width: '90px', height: '90px'}}>
                              <StableLottie path="/lottie/Money stack.json" speed={1.2} />
                            </div>
                          )}
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[13px] font-black px-3 py-1 rounded-lg inline-block" style={{background:'rgba(30,58,138,0.07)',color:'#1E3A8A'}}>{l.date || '날짜 미지정'}</span>
                                {l.role === 'Assistant' && <span className="text-[11px] font-black text-slate-400 border border-slate-200 px-1.5 rounded">보조</span>}
                              </div>
                              <h3 className="text-[17.5px] font-black text-[#0F172A] leading-tight tracking-tight relative z-10">{l.institution}</h3>
                            </div>
                            <div className="flex items-center gap-2 relative z-10">
                              <button onClick={() => handleTogglePaid(l)} className="btn-press text-[13px] font-black px-3.5 py-1.5 rounded-xl transition" style={l.isPaid?{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)',color:'#10B981'}:{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',color:'#F59E0B'}}>
                                {l.isPaid ? '✓ 완료' : '대기'}
                              </button>
                              <div className="relative">
                                <button onClick={(e) => {e.stopPropagation();setActiveMenuCardId(activeMenuCardId===l.id?null:l.id);}} className="btn-press p-2 rounded-xl hover:bg-slate-100 transition">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                </button>
                                {activeMenuCardId === l.id && (
                                  <div className="absolute right-0 top-10 bg-white border border-slate-200 shadow-xl rounded-xl z-20 py-1.5 px-1.5 flex flex-col gap-1 w-24">
                                    <button onClick={(e) => {e.stopPropagation();handleEditClick(l);setActiveMenuCardId(null);}} className="w-full text-left py-1.5 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-1.5"><Edit3 size={11} className="text-slate-400" />수정하기</button>
                                    <button onClick={(e) => {e.stopPropagation();if(confirm('이 강의 기록을 정말 삭제하시겠습니까?')){handleDelete(l.id);}setActiveMenuCardId(null);}} className="w-full text-left py-1.5 px-2 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5"><Trash2 size={11} className="text-red-400" />삭제하기</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-[60%_40%] gap-y-1.5 text-[14px] text-slate-500 py-3 border-t border-dashed border-slate-200 relative z-10">
                            <div className="flex items-center">
                              <span className="font-bold mr-1">단가:</span>
                              <span className="font-extrabold text-slate-800 text-[13px]">₩{formatWon(l.rate)}×{l.classes}h</span>
                            </div>
                            <div className="flex flex-col items-end justify-center pl-2 border-l border-slate-200">
                              {l.isPaid ? (
                                <button 
                                  onClick={() => setToggledCardIds(prev => { const n = new Set(prev); if(n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}
                                  className="flex flex-col items-end text-right transition-transform active:scale-95"
                                >
                                  {toggledCardIds.has(l.id) ? (
                                    <>
                                      <span className="text-[11px] font-extrabold text-slate-400 mb-0.5">실정산액</span>
                                      <span className="font-black text-[#10B981] text-[15px] leading-tight">₩{formatWon(l.netAmount)}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-[11px] font-extrabold text-slate-400 mb-0.5">총액 보기 (클릭)</span>
                                      <span className="font-black text-[#1E3A8A] text-[15px] leading-tight">₩{formatWon(l.expectedAmount)}</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <div className="flex flex-col items-end text-right">
                                  <span className="text-[11px] font-extrabold text-slate-400 mb-0.5">총액</span>
                                  <span className="font-black text-slate-400 text-[15px] leading-tight">₩{formatWon(l.expectedAmount)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
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
              className={`${getSlideClass()} flex flex-col gap-4 select-none`}
              onTouchStart={handleCalTouchStart}
              onTouchEnd={handleCalTouchEnd}
            >
              <div className="bg-white p-5 rounded-[24px] border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition active:scale-95 text-slate-500 font-bold"
                    >
                      &lt;
                    </button>
                    <h3 className="text-[17px] font-black text-slate-800 flex items-center gap-1.5 w-32 justify-center">
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
                <div className={`grid grid-cols-7 gap-y-3.5 gap-x-1 text-center text-xs transition-all duration-300 ${
                  calTransition === 'slide-left' ? 'translate-x-[-12px] opacity-0' :
                  calTransition === 'slide-right' ? 'translate-x-[12px] opacity-0' : 'translate-x-0 opacity-100'
                }`}>
                  {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                    <span key={`empty-${idx}`} />
                  ))}
                  
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${currentMonth + 1}월 ${day}일`;
                    
                    const dayLectures = lectures.filter(l => l.date && l.date.replace(/\s+/g, '').includes(dateStr.replace(/\s+/g, '')));
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
                        className={`flex flex-col items-center justify-center relative py-1 rounded-xl transition-all ${
                          hasLectures 
                            ? 'cursor-pointer bg-slate-50 hover:bg-blue-50/60 border border-slate-200/60' 
                            : 'text-slate-400'
                        } ${isToday ? 'ring-2 ring-[#1E3A8A]/30 bg-blue-50/20' : ''}`}
                      >
                        <span className={`text-[13px] font-black ${hasLectures ? 'text-[#0F172A] font-black text-[15px]' : 'text-slate-500'} ${isToday ? 'text-[#1E3A8A]' : ''}`}>{day}</span>
                        {/* 도트 */}
                        <div className="flex gap-0.5 justify-center mt-0.5 h-1">
                          {hasPaid && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {hasUnpaid && (
                            <span className={`w-1.5 h-1.5 rounded-full bg-amber-500 ${hasWarning ? 'relative' : ''}`}>
                              {hasWarning && (
                                <span className="absolute -inset-1 rounded-full bg-amber-500/40 animate-ping" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 달력 안내 안내카드 */}
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-[20px] text-[10.5px] text-slate-500 leading-relaxed flex flex-col gap-1.5">
                <span className="font-extrabold text-slate-700">💡 캘린더 안내</span>
                <p>일정이 등록된 날짜는 연하게 칠해지며, 터치 시 하단 시트(Bottom Sheet)에서 상세 정산내역을 바로 확인할 수 있습니다.</p>
                <div className="flex items-center gap-3 mt-1 font-bold">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/> 완료</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"/> 미정산 대기</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"/> 30일 초과 연체</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STATS */}
          {activeTab === 'stats' && (<div key="tab-stats" className={getSlideClass()}>
            <div className="flex flex-col gap-4">
              {/* DESIGN.md: Cinematic Typography stats — 6vw mobile */}
              <div className="bg-white p-5 rounded-[24px] shadow-sm" style={{border: '1px solid rgba(31,46,91,0.10)'}}>
                <span className="text-[15px] font-black block mb-4 text-slate-800">정산 누적액</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl" style={{background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))', border: '1px solid rgba(16,185,129,0.15)'}}>
                    <span className="text-[13px] font-black block mb-1.5" style={{color: '#10B981'}}>수령 완료</span>
                    <strong className="stat-number block" style={{fontSize: '6vw', color: '#10B981'}}>₩{formatWon(totalNet)}</strong>
                  </div>
                  <div className="p-4 rounded-2xl" style={{background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))', border: '1px solid rgba(245,158,11,0.15)'}}>
                    <span className="text-[13px] font-black block mb-1.5" style={{color: '#F59E0B'}}>대기 중</span>
                    <strong className="stat-number block" style={{fontSize: '6vw', color: '#F59E0B'}}>₩{formatWon(totalUnpaid)}</strong>
                  </div>
                </div>
              </div>

              {/* 월별 수입 및 시간 더블 바 차트 */}
              <div className="bg-white p-5 rounded-[24px] border border-slate-200/60 shadow-sm flex flex-col gap-4 animate-fade-in">
                <div>
                  <h4 className="text-[15px] font-black text-slate-800">월별 수입 & 출강 시간 추이</h4>
                  <p className="text-[11.5px] text-slate-400 mt-0.5 font-semibold">파란색: 수입(원) / 하늘색: 강의 시간(시간)</p>
                </div>
                {chartData.length === 0 ? (
                  <div className="text-[12px] text-slate-400 text-center py-10 font-bold">출강 데이터가 없습니다.</div>
                ) : (
                  <div className="flex flex-col gap-5 pt-2">
                    {chartData.map((d, idx) => {
                      const maxIncome = Math.max(...chartData.map(c => c.total), 1);
                      const maxHours = Math.max(...chartData.map(c => c.hours), 1);
                      const incomePercent = (d.total / maxIncome) * 100;
                      const hoursPercent = (d.hours / maxHours) * 100;

                      return (
                        <div key={idx} className="flex flex-col gap-1">
                          <span className="text-[12px] font-black text-slate-600">{d.month}</span>
                          <div className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            {/* 수입 바 */}
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className="text-slate-400">정산수입</span>
                              <span className="font-black text-slate-800">₩{formatWon(d.total)}</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#2563EB] rounded-full transition-all" style={{ width: `${incomePercent}%` }} />
                            </div>

                            {/* 시간 바 */}
                            <div className="flex items-center justify-between text-[11px] font-bold mt-1">
                              <span className="text-slate-400">강의시간</span>
                              <span className="font-black text-indigo-600">{d.hours}시간</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-sky-400 rounded-full transition-all" style={{ width: `${hoursPercent}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 주관사(기관)별 출강 비중 */}
              <div className="bg-white p-5 rounded-[24px] border border-slate-200/60 shadow-sm flex flex-col gap-3">
                <div>
                  <h4 className="text-[15px] font-black text-slate-800">주요 주관사별 비중</h4>
                  <p className="text-[11.5px] text-slate-400 mt-0.5 font-semibold">매출 기여도 기준 정렬</p>
                </div>
                {lectures.length === 0 ? (
                  <div className="text-[12px] text-slate-400 text-center py-10 font-bold">데이터가 없습니다.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {(() => {
                      // 기관별 총액 집계
                      const instMap = {};
                      let overallTotal = 0;
                      lectures.forEach(l => {
                        const amt = l.expectedAmount || 0;
                        instMap[l.institution] = (instMap[l.institution] || 0) + amt;
                        overallTotal += amt;
                      });

                      const sortedInsts = Object.entries(instMap)
                        .map(([name, val]) => ({ name, val, pct: overallTotal > 0 ? (val / overallTotal) * 100 : 0 }))
                        .sort((a, b) => b.val - a.val)
                        .slice(0, 5); // TOP 5

                      return sortedInsts.map((inst, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[12px] font-bold">
                            <span className="text-slate-700">{inst.name}</span>
                            <span className="text-slate-500">{Math.round(inst.pct)}% (₩{formatWon(inst.val)})</span>
                          </div>
                          <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                            <div 
                              className="h-full bg-indigo-500 rounded-full" 
                              style={{ width: `${inst.pct}%`, opacity: 1 - (i * 0.15) }} 
                            />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}



          {/* TAB 3: SYNC */}
          {activeTab === 'sync' && (<div key="tab-sync" className={getSlideClass()}>
            <div className="flex flex-col gap-4">
              <div className="bg-white p-4 rounded-[20px] border border-toss-border shadow-sm flex flex-col gap-3">
                <h3 className="text-[15px] font-black text-toss-textDark flex items-center gap-1.5">
                  <Database size={15} className="text-toss-blue" />
                  구글 스프레드시트 클라우드 백업
                </h3>

                {!sheetUrl ? (
                  <div className="p-4 bg-orange-50 border border-orange-200 text-toss-amber rounded-xl text-[12px] font-semibold leading-relaxed">
                    [환경 설정] 탭에 본인의 <strong>구글 시트 웹 앱 URL</strong>을 연동하면 클라우드 실시간 백업이 활성화됩니다.
                  </div>
                ) : (
                  <>
                    {syncMessage && (
                      <div className={`p-3 rounded-xl border text-[12px] font-semibold ${syncMessage.type === 'success' ? 'bg-green-50 border-green-200 text-toss-green' : 'bg-red-50 border-red-200 text-toss-red'}`}>
                        {syncMessage.text}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 mt-1">
                      <button
                        onClick={fetchFromGoogleSheet}
                        disabled={syncLoading}
                        className="w-full py-3.5 text-[13px] font-black bg-blue-50 border border-blue-100 text-toss-blue rounded-xl flex items-center justify-center gap-1 hover:bg-blue-100 transition"
                      >
                        {syncLoading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                        시트 데이터 불러오기 (Pull)
                      </button>
                      <button
                        onClick={() => syncToGoogleSheet(lectures)}
                        disabled={syncLoading}
                        className="w-full py-3.5 text-[13px] font-black bg-[#1F2E5B] text-white rounded-xl flex items-center justify-center gap-1 hover:bg-[#172346] transition"
                      >
                        {syncLoading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                        시트에 데이터 백업하기 (Push)
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Collect UI: Premium Animated File Upload Card */}
              <div className="bg-white p-5 rounded-[24px] border border-toss-border shadow-sm flex flex-col gap-3">
                <span className="text-[14px] font-black text-toss-textDark">로컬 데이터 내보내기 & 가져오기</span>
                
                <div className="grid grid-cols-1 gap-3.5">
                  {/* CSV Export Button */}
                  <button 
                    onClick={handleExportCSV} 
                    className="w-full py-3.5 bg-[#F8FAF8] border border-toss-border hover:border-toss-blue text-toss-textDark text-[13px] font-black rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <Download size={14} className="text-toss-blue" />
                    현재 출강 이력 CSV로 내려받기</button>
                  
                  {/* Collect UI Cloud Upload Area */}
                  <div className="relative border-2 border-dashed border-toss-border/80 rounded-2xl p-6 bg-[#F8FAF8] hover:bg-slate-50 transition-colors flex flex-col items-center justify-center text-center">
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleAnimatedUpload} 
                      className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                      disabled={isUploading}
                    />
                    
                    {/* Cloud Floating animation */}
                    <div className={`p-3 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-3 ${isUploading ? 'upload-pulse' : 'cloud-float'}`}>
                      <Cloud size={28} className="text-toss-blue" />
                    </div>
                    
                    {isUploading ? (
                      <div className="w-full max-w-[180px] flex flex-col items-center gap-2">
                        <span className="text-[10px] font-bold text-toss-blue">파일을 파싱하는 중...</span>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-toss-blue transition-all duration-75" style={{width: `${uploadProgress}%`}} />
                        </div>
                        <span className="text-[9px] text-slate-400 font-extrabold">{uploadProgress}%</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-[13px] font-black text-slate-800">CSV 백업 파일 가져오기</span>
                        <p className="text-[11px] text-slate-400 mt-1.5 leading-normal font-semibold">
                          이곳을 탭하거나 CSV 파일을 끌어놓으세요.<br/>
                          (이전 백업본이 현재 리스트와 병합됩니다.)
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}



          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (<div key="tab-settings" className={getSlideClass()}>
            <div className="flex flex-col gap-5">
              <div className="rounded-[24px] bg-white border border-slate-200/60 p-5 flex flex-col gap-5 shadow-sm">
                <div className="flex items-center gap-2"><Database size={18} className="text-[#1E3A8A]" /><h3 className="text-[15px] font-black text-slate-800 tracking-tight">API 연동 설정</h3></div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[13px] font-black text-slate-600">Gemini AI API Key</label>
                    <button type="button" onClick={() => alert('Google AI Studio (aistudio.google.com)에서 무료 발급\n\n1. aistudio.google.com 접속\n2. Get API Key 클릭\n3. Create API Key 클릭\n4. 발급된 키 복사 후 입력')} className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><span className="text-[11px] font-black">?</span></button>
                  </div>
                  <input type="password" id="settings-api-key-mobile" defaultValue={apiKey} placeholder="AIzaSy... (Gemini API Key)" className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-[14px] font-semibold focus:outline-none focus:border-[#1E3A8A] bg-[#F8FAFC] text-slate-800" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[13px] font-black text-slate-600">구글 시트 웹 앱 URL</label>
                    <button type="button" onClick={() => setIsScriptModalOpen(true)} className="text-[12px] font-black text-[#1E3A8A] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition">연동 방법 보기</button>
                  </div>
                  <input type="text" id="settings-sheet-url-mobile" defaultValue={sheetUrl} placeholder="https://script.google.com/macros/s/..." className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-[14px] font-semibold focus:outline-none focus:border-[#1E3A8A] bg-[#F8FAFC] text-slate-800" />
                </div>
                <button onClick={() => { const k=document.getElementById('settings-api-key-mobile').value; const u=document.getElementById('settings-sheet-url-mobile').value; handleSaveSettings(k,u); }} className="w-full py-4 text-[15px] font-black text-white bg-[#1E3A8A] hover:bg-[#0F172A] rounded-xl shadow-md transition">설정 정보 저장</button>
              </div>
              <div className="rounded-[24px] p-5 flex flex-col gap-3" style={{background:'linear-gradient(135deg,#FEF2F2 0%,#FFF1F2 100%)',border:'1px solid rgba(239,68,68,0.15)'}}>
                <div className="flex items-center gap-2"><AlertCircle size={17} className="text-red-500" /><span className="text-[14px] font-black text-red-700">기록 데이터 초기화</span></div>
                <p className="text-[12px] text-red-600/70 leading-relaxed font-semibold">앱 내에 기록된 모든 강의 데이터와 API 설정값을 지우고 초기화합니다. 이 작업은 되돌릴 수 없습니다.</p>
                <button onClick={() => { if(window.confirm('정말 전체 초기화하시겠습니까?')){safeLocalStorage.clear();setLectures([]);setApiKey('');setSheetUrl('');alert('초기화 완료. 새로고침합니다.');window.location.reload();}}} className="py-3.5 text-[14px] font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition">앱 전체 데이터 초기화</button>
              </div>
              <div className="rounded-[24px] p-5 bg-white border border-slate-200/60 shadow-sm flex flex-col gap-2 items-center text-center">
                <div className="flex items-center gap-2"><BookOpen size={17} className="text-[#1E3A8A]" /><span className="text-[15px] font-black text-slate-800">정산비서 정보</span></div>
                <p className="text-[11px] text-slate-400 font-bold">출강료 관리 모바일 대시보드 v1.2.2</p>
              </div>
            </div>
          </div>
          )}



        </div>

        {/* iOS-style Bottom Navigation Bar — motion: active pill indicator */}
        <div className="fixed bottom-0 left-0 right-0 z-40" style={{background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid rgba(31,46,91,0.08)', boxShadow: '0 -4px 20px rgba(31,46,91,0.08)', paddingBottom: 'env(safe-area-inset-bottom, 0px)'}}>
          

          
          <div className="flex items-center justify-around py-2 px-2">
            {[
              {id:'home', icon:<Home size={22}/>, label:'기록'},
              {id:'calendar', icon:<Calendar size={22}/>, label:'달력'},
              {id:'stats', icon:<BarChart size={22}/>, label:'분석'},
              {id:'sync', icon:<RefreshCw size={22}/>, label:'백업'},
              {id:'settings', icon:<Settings size={22}/>, label:'설정'}
            ].map(t => (
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
                {/* icon */}
                <span style={{transform: activeTab === t.id ? 'scale(1.12)' : 'scale(1)', transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)', display: 'block'}}>
                  {t.icon}
                </span>
                {/* label */}
                <span style={{fontSize: '11px', fontWeight: activeTab === t.id ? 800 : 600, letterSpacing: activeTab === t.id ? '-0.01em' : 0, lineHeight: 1}}>{t.label}</span>
                {/* active pill indicator */}
                {activeTab === t.id && (
                  <span style={{position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'24px', height:'2.5px', borderRadius:'99px', background:'#2563EB'}} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================
          [DESKTOP SCREEN VIEW] - Renders on desktop screens (>= 768px)
         ======================================================== */}
      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:flex flex-col min-h-screen" style={{background: '#F8FAFC'}}>
        {/* DESIGN.md: Top Navigation Bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* 3D Coin Lottie Logo */}
              <StableLottie path="/lottie/Fake 3D vector coin.json" className="w-[38px] h-[38px] drop-shadow-sm flex-shrink-0" />
              <div>
                <h1 className="text-slate-900 font-black tracking-tight" style={{fontSize: '22px', lineHeight: 1.15}}>
                  정산비서
                </h1>
                <p style={{fontSize: '11px', color: '#64748B', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase'}}>출강료 정산 비서</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-400 hover:text-slate-600 transition hover:bg-slate-50 rounded-xl border border-slate-100 bg-white"
                title="환경 설정"
              >
                <Settings size={16} />
              </button>
              <button 
                onClick={() => {
                  setAiText('');
                  setAiError(null);
                  setParsedLectures([]);
                  setIsAiVerifying(false);
                  setIsAiModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition border border-slate-100 bg-white text-slate-600 hover:bg-slate-50"
              >
                <Sparkles size={13} className="text-indigo-600" />
                AI 카톡 등록
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition border border-slate-100 bg-white text-slate-600 hover:bg-slate-50"
              >
                <Download size={13} /> CSV 내보내기
              </button>
              <label className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer border border-slate-100 bg-white text-slate-600 hover:bg-slate-50">
                <Upload size={13} /> CSV 업로드
                <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
              </label>
              <button
                onClick={() => {
                  setEditingLecture(null);
                  setFormData({
                    institution: '',
                    role: 'Main',
                    rate: 100000,
                    classes: 4,
                    transportFee: 0,
                    month: getNextMonthString(),
                    date: '',
                    registrationDate: new Date().toISOString().slice(0, 10),
                    isPaid: false,
                    taxRate: '8.8%',
                    taxBase: 'LectureOnly',
                    customTax: 0
                  });
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-sm"
              >
                <Plus size={14} /> 기록
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-6 max-w-6xl mx-auto px-8 py-8 w-full">

        {/* Cloud Sync Status bar */}
        {sheetUrl && (
          <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-[20px] flex items-center justify-between text-xs text-toss-blue">
            <span className="flex items-center gap-1.5 font-bold">
              <Database size={15} />
              구글 시트 연동 상태: 정상 작동 중
            </span>
            <div className="flex gap-2">
              <button 
                onClick={fetchFromGoogleSheet}
                className="bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition font-bold"
              >
                시트에서 가져오기 (Pull)
              </button>
              <button 
                onClick={() => syncToGoogleSheet(lectures)}
                className="bg-[#1F2E5B] text-white px-3 py-1.5 rounded-lg hover:bg-[#172346] transition font-bold"
              >
                시트에 저장하기 (Push)
              </button>
            </div>
          </div>
        )}

        {/* DESIGN.md: Statistics Widgets — Cinematic Typography 3vw scale */}
        <div className="grid grid-cols-3 gap-5">
          {/* Paid Total */}
          <div 
            onMouseMove={handleCardMouseMove}
            className="spotlight-card rounded-[24px] p-6 relative overflow-hidden" 
            style={{background: 'white', border: '1px solid rgba(31,46,91,0.08)', boxShadow: '0 2px 16px rgba(31,46,91,0.06)'}}
          >
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5" style={{background: '#10B981', transform: 'translate(30%, -30%)'}} />
            <span className="text-xs font-semibold block mb-1" style={{color: '#64748B', letterSpacing: '0.03em'}}>정산 완료 실수령액</span>
            <div className="flex items-center gap-2 mt-2">
              <CheckCircle2 size={16} color="#10B981" />
              <span style={{fontSize: '11px', color: '#10B981', fontWeight: 700}}>{lectures.filter(l=>l.isPaid).length}건 완료</span>
            </div>
            {/* DESIGN.md: Cinematic Typography — 3vw, weight 900, letter-spacing -0.03em */}
            <div className="stat-number mt-3" style={{fontSize: 'clamp(22px, 3vw, 40px)', color: '#10B981'}}>
              <ShinyText text={"₩" + formatWon(totalNet)} />
            </div>
          </div>

          {/* Expected Total */}
          <div 
            onMouseMove={handleCardMouseMove}
            className="spotlight-card rounded-[24px] p-6 relative overflow-hidden" 
            style={{background: 'white', border: '1px solid rgba(31,46,91,0.08)', boxShadow: '0 2px 16px rgba(31,46,91,0.06)'}}
          >
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5" style={{background: '#1F2E5B', transform: 'translate(30%, -30%)'}} />
            <span className="text-xs font-semibold block mb-1" style={{color: '#64748B', letterSpacing: '0.03em'}}>총 예상 수령액 (전체)</span>
            <div className="flex items-center gap-2 mt-2">
              <Info size={16} color="#1F2E5B" />
              <span style={{fontSize: '11px', color: '#1F2E5B', fontWeight: 700}}>{lectures.length}건 전체</span>
            </div>
            <div className="stat-number mt-3" style={{fontSize: 'clamp(22px, 3vw, 40px)', color: '#1F2E5B'}}>
              <ShinyText text={"₩" + formatWon(totalExpected)} />
            </div>
          </div>

          {/* Unpaid Total */}
          <div 
            onMouseMove={handleCardMouseMove}
            className="spotlight-card rounded-[24px] p-6 relative overflow-hidden" 
            style={{background: 'linear-gradient(135deg, #fffbeb 0%, #fffde7 100%)', border: '1px solid rgba(245,158,11,0.20)', boxShadow: '0 2px 16px rgba(245,158,11,0.08)'}}
          >
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10" style={{background: '#F59E0B', transform: 'translate(30%, -30%)'}} />
            <span className="text-xs font-semibold block mb-1" style={{color: '#64748B', letterSpacing: '0.03em'}}>미정산 대기 총액</span>
            <div className="flex items-center gap-2 mt-2">
              <AlertCircle size={16} color="#F59E0B" />
              <span style={{fontSize: '11px', color: '#F59E0B', fontWeight: 700}}>{unpaidCount}건 대기</span>
            </div>
            <div className="stat-number mt-3" style={{fontSize: 'clamp(22px, 3vw, 40px)', color: '#F59E0B'}}>
              <ShinyText text={"₩" + formatWon(totalUnpaid)} />
            </div>
          </div>
        </div>

        {/* Grid: Chart & Table */}
        <div className="grid grid-cols-3 gap-6">
          {/* Chart Left column */}
          <div className="bg-white p-5 rounded-[24px] border border-toss-border shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-toss-textDark">월별 정산 비율</h3>
              <p className="text-[11px] text-toss-textSub mt-0.5">정산완료(남색) / 대기(빗금)</p>
            </div>

            <div className="h-44 flex items-end justify-between px-2 pt-6 border-b border-toss-border">
              {chartData.length === 0 ? (
                <div className="w-full text-center text-xs text-toss-textSub pb-12">데이터 없음</div>
              ) : (
                chartData.map((d, idx) => {
                  const totalHeightPercent = (d.total / maxChartValue) * 110;
                  const paidHeight = (d.paid / d.total) * totalHeightPercent || 0;
                  const unpaidHeight = (d.unpaid / d.total) * totalHeightPercent || 0;

                  return (
                    <div key={idx} className="flex flex-col items-center flex-1 group relative">
                      <div className="w-6 flex flex-col justify-end items-center rounded-t overflow-hidden" style={{ height: `${Math.max(totalHeightPercent, 4)}px` }}>
                        {d.unpaid > 0 && <div className="w-full" style={{ height: `${unpaidHeight}px`, background: 'rgba(37,99,235,0.15)' }} />}
                        {d.paid > 0 && <div className="w-full bg-[#1F2E5B]" style={{ height: `${paidHeight}px` }} />}
                      </div>
                      <span className="text-[10px] font-bold text-toss-textSub mt-2">{d.month}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* DESIGN.md: Typography Ledger Grid — right 2/3 column */}
          <div className="col-span-2 rounded-[24px] overflow-hidden flex flex-col" style={{background: 'white', border: '1px solid rgba(31,46,91,0.10)', boxShadow: '0 2px 16px rgba(31,46,91,0.06)'}}>
            {/* Table toolbar */}
            <div className="px-5 py-3 flex items-center justify-between" style={{background: 'rgba(31,46,91,0.03)', borderBottom: '1px solid rgba(31,46,91,0.08)'}}>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2" size={15} style={{color: '#94a3b8'}} />
                <input 
                  type="text" 
                  placeholder="교육 기관 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs rounded-xl px-3 py-1.5"
                  style={{paddingLeft: '32px', border: '1px solid rgba(31,46,91,0.12)', background: 'white', color: '#1F2E5B', outline: 'none'}}
                />
              </div>

              <div className="flex gap-2">
                <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-[11px] font-semibold rounded-lg px-2.5 py-1.5"
                  style={{border: '1px solid rgba(31,46,91,0.12)', background: 'white', color: '#475569'}}
                >
                  <option value="All">전체 월</option>
                  {uniqueMonths.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                </select>
                <select 
                  value={selectedStatus} 
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="text-[11px] font-semibold rounded-lg px-2.5 py-1.5"
                  style={{border: '1px solid rgba(31,46,91,0.12)', background: 'white', color: '#475569'}}
                >
                  <option value="All">전체 상태</option>
                  <option value="Paid">정산 완료</option>
                  <option value="Pending">정산 대기</option>
                </select>
              </div>
            </div>

            {/* DESIGN.md: Typography Ledger Grid — table body */}
            {filteredLectures.length === 0 ? (
              <div className="flex-1 py-16 px-6 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{background: 'rgba(31,46,91,0.06)'}}>
                  <Database size={28} color="rgba(31,46,91,0.35)" />
                </div>
                <div>
                  <h4 className="text-sm font-bold" style={{color: '#1F2E5B', fontWeight: 900}}>출강 기록이 없습니다</h4>
                  <p className="text-[11px] mt-1" style={{color: '#64748B'}}>강의 일정을 직접 등록하거나 샘플 데이터로 체험해 보세요.</p>
                </div>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => {
                      setLectures([
                        { id: "sample-1", institution: "사회복지협의회/목포경애원", rate: 100000, classes: 3, expectedAmount: 300000, transportFee: 0, deduction: -26400, netAmount: 273600, month: "6월", date: "6월 15일", registrationDate: "2026-06-15", isPaid: true, taxRate: "8.8%", taxBase: "LectureOnly", customTax: 0 },
                        { id: "sample-2", institution: "전남공업고등학교", rate: 100000, classes: 2, expectedAmount: 250000, transportFee: 50000, deduction: 0, netAmount: 0, month: "6월", date: "6월 20일", registrationDate: "2026-06-20", isPaid: false, taxRate: "3.3%", taxBase: "LectureOnly", customTax: 0 },
                        { id: "sample-3", institution: "혜림종합복지관", rate: 100000, classes: 4, expectedAmount: 400000, transportFee: 0, deduction: -35200, netAmount: 364800, month: "6월", date: "6월 22일", registrationDate: "2026-06-22", isPaid: true, taxRate: "8.8%", taxBase: "LectureOnly", customTax: 0 },
                        { id: "sample-4", institution: "TMD교육/벌교 보성중", rate: 50000, classes: 6, expectedAmount: 384000, transportFee: 84000, deduction: -9900, netAmount: 374100, month: "7월", date: "7월 05일", registrationDate: "2026-06-29", isPaid: true, taxRate: "3.3%", taxBase: "LectureOnly", customTax: 0 }
                      ]);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                  >
                    샘플 데이터 채우기
                  </button>
                  <button
                    onClick={() => {
                      setEditingLecture(null);
                      setFormData({ institution: '', role: 'Main', rate: 100000, classes: 4, transportFee: 0, date: '', registrationDate: new Date().toISOString().slice(0, 10), isPaid: false, taxRate: '8.8%', taxBase: 'LectureOnly', customTax: 0 });
                      setIsAddModalOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-sm"
                  >
                    직접 등록하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto" style={{maxHeight: '380px', overflowY: 'auto'}}>
                {/* DESIGN.md: Ledger Grid — ledger-table class = 1px #1F2E5B/10 borders */}
                <table className="ledger-table text-xs">
                  <thead>
                    <tr style={{background: 'rgba(31,46,91,0.05)', position: 'sticky', top: 0, zIndex: 1}}>
                      <th className="px-4 py-3 text-left font-bold" style={{color: '#1F2E5B', whiteSpace: 'nowrap'}}>교육 기관명</th>
                      <th className="px-3 py-3 text-right font-bold" style={{color: '#1F2E5B', whiteSpace: 'nowrap'}}>단가 × 시간</th>
                      <th className="px-3 py-3 text-right font-bold" style={{color: '#1F2E5B', whiteSpace: 'nowrap'}}>예상액</th>
                      <th className="px-3 py-3 text-right font-bold" style={{color: '#1F2E5B', whiteSpace: 'nowrap'}}>교통비</th>
                      <th className="px-3 py-3 text-right font-bold" style={{color: '#1F2E5B', whiteSpace: 'nowrap'}}>공제</th>
                      <th className="px-3 py-3 text-right font-bold" style={{color: '#00BCD4', whiteSpace: 'nowrap'}}>실수령액</th>
                      <th className="px-3 py-3 text-center font-bold" style={{color: '#1F2E5B', whiteSpace: 'nowrap'}}>기간</th>
                      <th className="px-4 py-3 text-center font-bold" style={{color: '#1F2E5B', whiteSpace: 'nowrap'}}>정산상태</th>
                      <th className="px-4 py-3 text-center font-bold" style={{color: '#1F2E5B', whiteSpace: 'nowrap'}}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLectures.map((lecture) => (
                      <tr key={lecture.id} style={{cursor: 'default'}}>
                        {/* DESIGN.md: Ledger Grid — ledger-cell: hover bg #1F2E5B/8, text #00BCD4 */}
                        <td className="ledger-cell px-4 py-3 font-bold" style={{color: '#1F2E5B'}}>{lecture.institution}</td>
                        <td className="ledger-cell px-3 py-3 text-right" style={{color: '#475569'}}>
                          ₩{formatWon(lecture.rate)} × {lecture.classes}h
                        </td>
                        <td className="ledger-cell px-3 py-3 text-right font-semibold" style={{color: '#475569'}}>
                          ₩{formatWon(lecture.expectedAmount)}
                        </td>
                        <td className="ledger-cell px-3 py-3 text-right" style={{color: '#64748B'}}>
                          {lecture.transportFee > 0 ? '₩' + formatWon(lecture.transportFee) : '—'}
                        </td>
                        <td className="ledger-cell px-3 py-3 text-right font-medium" style={{color: '#EF4444'}}>
                          {lecture.isPaid && lecture.deduction !== 0 ? '₩' + formatWon(lecture.deduction) : '—'}
                        </td>
                        <td className="ledger-cell px-3 py-3 text-right font-black" style={{color: lecture.isPaid ? '#10B981' : '#94a3b8', letterSpacing: '-0.01em'}}>
                          {lecture.isPaid ? '₩' + formatWon(lecture.netAmount) : '—'}
                        </td>
                        <td className="ledger-cell px-3 py-3 text-center">
                          <div className="font-semibold" style={{color: '#1F2E5B'}}>{lecture.month}</div>
                          <div style={{fontSize: '10px', color: '#94a3b8', marginTop: '2px'}}>{lecture.date}</div>
                        </td>
                        <td className="ledger-cell px-4 py-3 text-center">
                          <button
                            onClick={() => handleTogglePaid(lecture)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition"
                            style={lecture.isPaid
                              ? {background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981'}
                              : {background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B'}
                            }
                          >
                            {lecture.isPaid ? '✓ 완료' : '⏳ 대기'}
                          </button>
                        </td>
                        <td className="ledger-cell px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleEditClick(lecture)} className="p-1.5 rounded-lg transition" style={{color: '#64748B'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(31,46,91,0.06)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <Edit3 size={12} />
                            </button>
                            <button onClick={() => handleDelete(lecture.id)} className="p-1.5 rounded-lg transition" style={{color: '#EF4444'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.08)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Apps Script template description area */}
        <div className="p-6 rounded-[24px] flex flex-col gap-4" style={{background: 'white', border: '1px solid rgba(31,46,91,0.08)', boxShadow: '0 2px 16px rgba(31,46,91,0.06)'}}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold flex items-center gap-1.5" style={{color: '#1F2E5B', fontWeight: 800}}>
              <BookOpen size={15} color="#00BCD4" />
              구글 시트 연동용 Apps Script 코드
            </h3>
            <button
              onClick={() => {
                copyToClipboard(gasTemplateCode, () => {
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                });
              }}
              className="text-[11px] font-bold flex items-center gap-1"
              style={{color: '#00BCD4'}}
            >
              <Copy size={12} />
              {copiedCode ? '복사 완료!' : '코드 복사'}
            </button>
          </div>
          <pre className="p-4 rounded-xl overflow-x-auto text-[10px] font-mono leading-relaxed" style={{background: '#0f1729', color: '#a5b4fc', maxHeight: '140px', overflowY: 'auto'}}>
            {gasTemplateCode}
          </pre>
        </div>

        </div>{/* end inner max-w-6xl container */}
      </div>{/* end desktop view */}

      {/* DESIGN.md: Scroll-Linked Interactive Index — pure SVG + JS scroll listener */}
      {/* Track: #1F2E5B 8% opacity, gauge fill: #00BCD4, magnetic Bezier on proximity */}
      <div className="hidden md:block fixed right-0 top-0 bottom-0 z-50 pointer-events-none" style={{width: '28px'}}>
        <svg width="28" height="100%" style={{position: 'absolute', top: 0, left: 0}}>
          {/* Base track — #1F2E5B 8% opacity */}
          <line x1="14" y1="20" x2="14" y2="100%" stroke="#1F2E5B" strokeWidth="2" strokeOpacity="0.12" />
          
          {/* Scroll progress fill — #00BCD4 */}
          {/* Uses strokeDashoffset to fill from top proportionally to scroll */}
          <line
            x1="14" y1="20"
            x2="14" y2="100%"
            stroke="#00BCD4"
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              strokeDasharray: 2000,
              strokeDashoffset: 2000 - (scrollProgress * 2000),
              transition: 'stroke-dashoffset 0.1s linear'
            }}
          />

          {/* Magnetic Bezier curve effect on mouse proximity */}
          {isNearIndex && (
            <path
              d={`M 14 ${Math.max(20, mouseY - 80)} Q ${14 - 18} ${mouseY} 14 ${Math.min(window.innerHeight - 20, mouseY + 80)}`}
              fill="none"
              stroke="#00BCD4"
              strokeWidth="3"
              strokeOpacity="0.60"
              strokeLinecap="round"
              style={{transition: 'd 0.08s cubic-bezier(0.22,1,0.36,1)'}}
            />
          )}

          {/* Scroll thumb dot */}
          <circle
            cx="14"
            cy={20 + scrollProgress * (window.innerHeight - 40)}
            r="4"
            fill="#00BCD4"
            style={{transition: 'cy 0.1s linear'}}
          />
        </svg>
      </div>

      {/* ========================================================
          [MODAL 3]: Add/Edit Lecture Modal — Redesigned with Preset Picker
         ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 flex items-end md:items-center justify-center p-0 md:p-4 z-50 backdrop-blur-fade">
          <div className="bg-white w-full md:max-w-md rounded-t-[32px] md:rounded-[28px] max-h-[92vh] md:max-h-none flex flex-col pb-6 md:pb-0 shadow-2xl bottom-sheet-enter md:modal-zoom-in overflow-hidden" style={{boxShadow: '0 -4px 40px rgba(31,46,91,0.18)'}}>
            {/* Drag handle */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3 md:hidden flex-shrink-0" />

            {/* Folder-Tab style Header: 직접 등록 / 즐겨찾기 선택 */}
            <div className="px-5 pt-4 pb-0 flex items-end justify-between bg-slate-100/80 border-b border-slate-200">
              <div className="flex gap-1">
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, _tab: 'record' }))} className="px-5 py-3 text-[13.5px] font-black rounded-t-xl transition-all border-t border-x" style={{color:(formData._tab||'record')==='record'?'#1E3A8A':'#64748B',backgroundColor:(formData._tab||'record')==='record'?'#FFFFFF':'transparent',borderColor:(formData._tab||'record')==='record'?'#CBD5E1 #CBD5E1 transparent #CBD5E1':'transparent',borderTopWidth:(formData._tab||'record')==='record'?'3px':'1px',borderTopColor:(formData._tab||'record')==='record'?'#1E3A8A':'transparent',transform:(formData._tab||'record')==='record'?'translateY(1px)':'none',zIndex:(formData._tab||'record')==='record'?10:1}}>
                  {editingLecture ? '기록 수정 ✏️' : '직접 등록 ✍️'}
                </button>
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, _tab: 'presets' }))} className="px-5 py-3 text-[13.5px] font-black rounded-t-xl transition-all border-t border-x" style={{color:(formData._tab||'presets')==='presets'?'#1E3A8A':'#64748B',backgroundColor:(formData._tab||'presets')==='presets'?'#FFFFFF':'transparent',borderColor:(formData._tab||'presets')==='presets'?'#CBD5E1 #CBD5E1 transparent #CBD5E1':'transparent',borderTopWidth:(formData._tab||'presets')==='presets'?'3px':'1px',borderTopColor:(formData._tab||'presets')==='presets'?'#1E3A8A':'transparent',transform:(formData._tab||'presets')==='presets'?'translateY(1px)':'none',zIndex:(formData._tab||'presets')==='presets'?10:1}}>
                  즐겨찾기 선택 ⭐
                </button>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-xl mb-2.5 transition">
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
                          transportFee: preset.transportFee || 0,
                          taxRate: preset.taxRate || '8.8%',
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
                        {p.name} — {p.role === 'Assistant' ? '보조' : '주강사'} · ₩{formatWon(p.rate)}/h · {p.taxRate}
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
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-500 text-[11px]">출강 날짜 (선택)</label>
                  <input
                    type="text"
                    name="date"
                    placeholder={`${new Date().getMonth()+1}월 ${new Date().getDate()}일`}
                    value={formData.date}
                    onChange={handleInputChange}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A8A] text-[11px] font-semibold bg-white"
                  />
                </div>

                {/* 게시등록일 */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-500 text-[11px]">게시등록일 (선택)</label>
                  <input
                    type="date"
                    name="registrationDate"
                    value={formData.registrationDate}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none bg-white text-[11px] font-semibold"
                  />
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
                        <option value="8.8%">8.8% (기타소득)</option>
                        <option value="3.3%">3.3% (사업소득)</option>
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
                        <div className="text-[10px] text-[#475569] mt-0.5 font-semibold">{p.role === 'Assistant' ? '보조강사' : '주강사'} | ₩{formatWon(p.rate)}/시간 | 세율 {p.taxRate}</div>
                      </div>
                      <button type="button" onClick={() => { if (window.confirm(`"${p.name}" 즐겨찾기를 삭제하시겠습니까?`)) setPresets(prev => prev.filter(x => x.id !== p.id)); }} className="ml-3 p-2 text-red-400 hover:bg-red-50 rounded-xl transition flex-shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-2xl flex flex-col gap-3" style={{background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)', border: '1px dashed rgba(30,58,138,0.25)'}}>
                  <span className="font-black text-[11.5px] text-[#1E3A8A]">⭐ 새 즐겨찾기 추가</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, _showEmojiPicker: !prev._showEmojiPicker }))} className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-lg shadow-sm flex-shrink-0">{formData._newPresetEmoji || '🏫'}</button>
                    <input type="text" placeholder="기관명 입력" value={formData._newPresetName || ''} onChange={e => setFormData(prev => ({ ...prev, _newPresetName: e.target.value }))} className="flex-1 px-3 py-2 border border-blue-200 rounded-xl bg-white text-[11px] font-bold focus:outline-none focus:border-[#1E3A8A]" />
                  </div>
                  {formData._showEmojiPicker && (
                    <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-3 grid grid-cols-5 gap-1.5">
                      {['🏫','🎓','🏢','💼','💻','💡','🤖','📚','✏️','✨','⭐','🔥','🌍','🚀','🎨','🧩','📈','🎯','📢','🏛️'].map(e => (
                        <button key={e} type="button" onClick={() => setFormData(prev => ({ ...prev, _newPresetEmoji: e, _showEmojiPicker: false }))} className="w-8 h-8 rounded-lg hover:bg-blue-50 flex items-center justify-center text-lg">{e}</button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <select value={formData._newPresetRole || 'Main'} onChange={e => setFormData(prev => ({ ...prev, _newPresetRole: e.target.value }))} className="px-3 py-2 bg-white border border-blue-100 rounded-xl text-[11px] font-bold"><option value="Main">주강사</option><option value="Assistant">보조강사</option></select>
                    <input type="number" placeholder="시간당 단가(원)" value={formData._newPresetRate || ''} onChange={e => setFormData(prev => ({ ...prev, _newPresetRate: e.target.value }))} className="px-3 py-2 border border-blue-100 rounded-xl bg-white text-[11px] font-bold focus:outline-none" />
                  </div>
                  <select value={formData._newPresetTax || '8.8%'} onChange={e => setFormData(prev => ({ ...prev, _newPresetTax: e.target.value }))} className="px-3 py-2 bg-white border border-blue-100 rounded-xl text-[11px] font-bold"><option value="8.8%">공제세율 8.8% (기본)</option><option value="3.3%">공제세율 3.3%</option><option value="None">공제 없음 (0%)</option></select>
                  <button type="button" onClick={() => { const name=(formData._newPresetName||'').trim(); if(!name){alert('기관명을 입력해 주세요.');return;} const emoji=formData._newPresetEmoji||'🏫'; setPresets(prev=>[...prev,{id:`p-${Date.now()}`,name:`[${emoji}] ${name}`,role:formData._newPresetRole||'Main',rate:Number(formData._newPresetRate)||100000,classes:2,transportFee:0,taxRate:formData._newPresetTax||'8.8%'}]); setFormData(prev=>({...prev,_newPresetName:'',_newPresetRate:'',_newPresetRole:'Main',_newPresetTax:'8.8%',_newPresetEmoji:'🏫',_showEmojiPicker:false})); alert('즐겨찾기가 저장되었습니다!'); }} className="w-full py-2.5 bg-[#1E3A8A] hover:bg-[#0F172A] text-white font-black rounded-xl text-[11.5px] shadow-sm transition">새 즐겨찾기 추가 저장</button>
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
        <div className="fixed inset-0 flex items-end md:items-center justify-center p-0 md:p-4 z-50 backdrop-blur-fade">
          <div className="bg-white w-full md:max-w-xl rounded-t-[32px] md:rounded-[28px] max-h-[90vh] overflow-y-auto flex flex-col pb-8 md:pb-0 shadow-2xl bottom-sheet-enter md:modal-zoom-in" style={{boxShadow: '0 -4px 40px rgba(31,46,91,0.18)'}}>
            {/* drag handle for mobile */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3 md:hidden flex-shrink-0" />


            <div className="p-5 border-b border-toss-border flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-extrabold text-toss-textDark flex items-center gap-1.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-600 animate-pulse">
                  <path d="M12.0001 2.5293C11.9682 7.64332 7.84279 11.7779 2.70898 11.8398C7.84279 11.9017 11.9682 16.0363 12.0001 21.1503C12.032 16.0363 16.1574 11.9017 21.2912 11.8398C16.1574 11.7779 12.032 7.64332 12.0001 2.5293Z" fill="currentColor"/>
                </svg>
                {isAiVerifying ? 'AI 파싱 결과 검토' : 'AI 카톡 일정 등록'}
              </h3>
              <button 
                onClick={() => {
                  setIsAiModalOpen(false);
                  setIsAiVerifying(false);
                }} 
                className="p-1 text-toss-textSub hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {!isAiVerifying ? (
              <div className="p-5 flex flex-col gap-4 text-xs">
                <p className="text-toss-textMuted leading-relaxed">
                  카톡으로 전달받은 안내 공지 메시지를 복사해 붙여넣으면 AI가 핵심 필드(일정, 장소, 금액 등)를 분석합니다.
                </p>

                {!apiKey && (
                  <div className="p-3.5 bg-orange-50 border border-orange-200 text-toss-amber rounded-xl text-[10px] leading-relaxed flex items-center justify-between">
                    <span>이 기능을 쓰시려면 환경설정에 Gemini API Key를 등록하셔야 합니다.</span>
                  </div>
                )}

                <textarea
                  rows="8"
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder={`[여기에 메시지 붙여넣기]
안녕하세요 강사님 다음 주 일정입니다.
10/22(수) 09:00~12:00 (3차시) - 광주사회복지회관
단가 100,000원, 교통비 20,000원`}
                  className="w-full px-3 py-2 border border-toss-border rounded-xl focus:outline-none focus:border-toss-blue bg-[#F8FAF8] resize-none"
                />

                {aiError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-toss-red rounded-lg">
                    {aiError}
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleMockParse}
                    disabled={aiLoading}
                    className="w-full py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition"
                  >
                    🚀 [체험용 목업 테스트] 키 없이 파싱 흐름 시뮬레이션
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAiModalOpen(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-toss-textMuted font-bold rounded-xl"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleAiParse}
                      disabled={aiLoading || !aiText.trim() || !apiKey}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:bg-indigo-300 shadow-md flex items-center justify-center gap-1.5"
                    >
                      {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : 'AI 분석 시작'}
                    </button>
                  </div>
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

                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-toss-textSub">게시등록일</label>
                          <input 
                            type="date"
                            value={item.registrationDate}
                            onChange={(e) => handleParsedFieldChange(idx, 'registrationDate', e.target.value)}
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
                        <span className="font-extrabold text-toss-textDark">예상수령: ₩{formatWon(item.expectedAmount)}</span>
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
                  <div className="text-center mt-2 text-[11px] font-bold text-indigo-600 bg-indigo-50 py-2 rounded-lg border border-indigo-100">
                    ※ 목업 테스트용 가상 데이터입니다. 확인 후 이전으로 돌아가주세요.
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
                <span className="font-black text-[11.5px] text-[#1E3A8A] flex items-center gap-1.5"><Database size={14} /> API 연동</span>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-600">Gemini AI API Key</label>
                  <input type="password" id="settings-api-key-desktop" defaultValue={apiKey} placeholder="AIzaSy..." className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:outline-none focus:border-[#1E3A8A]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="font-bold text-slate-600">구글 시트 웹 앱 URL</label>
                    <button type="button" onClick={() => setIsScriptModalOpen(true)} className="text-[10px] font-black text-[#1E3A8A] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition">연동 방법</button>
                  </div>
                  <input type="text" id="settings-sheet-url-desktop" defaultValue={sheetUrl} placeholder="https://script.google.com/macros/s/..." className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:outline-none focus:border-[#1E3A8A]" />
                </div>
              </div>
              <div className="rounded-2xl p-4 bg-red-50 border border-red-200/60 flex flex-col gap-2">
                <span className="text-[11px] font-black text-red-700 flex items-center gap-1.5"><AlertCircle size={13} className="text-red-500" /> 기록 데이터 초기화</span>
                <button type="button" onClick={() => { if (window.confirm('정말 전체 초기화하시겠습니까? 등록된 모든 데이터가 삭제됩니다.')) { safeLocalStorage.clear(); setLectures([]); setApiKey(''); setSheetUrl(''); alert('초기화 완료. 새로고침합니다.'); window.location.reload(); } }} className="py-2 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-md transition text-[11px]">앱 전체 데이터 초기화</button>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button type="button" onClick={() => setIsSettingsOpen(false)} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-xl transition">닫기</button>
              <button type="button" onClick={() => { const k=document.getElementById('settings-api-key-desktop').value; const u=document.getElementById('settings-sheet-url-desktop').value; handleSaveSettings(k,u); setIsSettingsOpen(false); }} className="w-full py-2.5 bg-[#1E3A8A] text-white font-black rounded-xl shadow-md hover:bg-[#0F172A] transition">설정 저장</button>
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
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5"><Database size={15} className="text-[#1E3A8A]" /> Apps Script 연동 가이드</h3>
              <button onClick={() => setIsScriptModalOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-xl transition"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 text-xs text-slate-700">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="font-black text-[#1E3A8A] text-[11px] mb-1">Q. PC와 스마트폰 데이터가 따로 노는 이유?</p>
                <p className="text-slate-600 font-semibold leading-relaxed">본 앱은 브라우저 로컬 저장소에 데이터를 보관하므로, PC와 폰은 자동 동기화되지 않습니다.</p>
                <p className="font-black text-emerald-600 text-[11px] mt-2 mb-1">A. 구글 시트 URL로 수동 동기화 가능!</p>
                <p className="text-slate-600 font-semibold leading-relaxed">양쪽 기기에 동일한 구글 시트 URL을 등록 후, <strong>[Push]</strong>로 업로드, <strong>[Pull]</strong>로 다운로드하세요.</p>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="font-black text-sm text-[#0F172A]">⚙️ 구글 스프레드시트 연동 방법</h4>
                <ol className="list-decimal pl-5 flex flex-col gap-1.5 text-slate-500 font-semibold leading-relaxed">
                  <li>Google 스프레드시트를 새로 만듭니다.</li>
                  <li>상단 메뉴 <strong>[확장 프로그램] → [Apps Script]</strong> 클릭</li>
                  <li>기존 코드 삭제 후 아래 코드 붙여넣기</li>
                  <li><strong>[배포] → [새 배포]</strong> 클릭</li>
                  <li>유형: <strong>"웹 앱"</strong>, 액세스: <strong>"모든 사용자"</strong> 설정 후 배포</li>
                  <li>발급된 URL을 설정 탭에 입력</li>
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
              {lectures.filter(l => l.date && l.date.replace(/\s+/g, '').includes(selectedCalendarDate.replace(/\s+/g, ''))).map((l) => (
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
                      <p className="text-[9.5px] text-slate-400 mt-1">단가 ₩{formatWon(l.rate)} × {l.classes}차시</p>
                    </div>
                    <button
                      onClick={() => handleTogglePaid(l)}
                      className="text-[9.5px] font-black px-2.5 py-1 rounded-xl transition"
                      style={l.isPaid
                        ? {background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981'}
                        : {background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.20)', color: '#64748B'}
                      }
                    >
                      {l.isPaid ? '✓ 완료' : '⏳ 대기'}
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center mt-1 pt-2 border-t border-dashed border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9.5px] text-slate-400">실수령액:</span>
                      <strong className="text-xs font-black text-slate-800">
                        ₩{l.isPaid ? formatWon(l.netAmount) : formatWon(l.expectedAmount)}
                      </strong>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setReceiptItem(l);
                        setSelectedCalendarDate(null);
                      }}
                      className="text-[9.5px] font-bold px-2.5 py-0.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition"
                    >
                      영수증
                    </button>
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
                  <span className="font-bold text-slate-900">₩{formatWon(receiptItem.rate * receiptItem.classes)}</span>
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between pl-3">
                  <span>(₩{formatWon(receiptItem.rate)} × {receiptItem.classes}시간)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">추가 교통비:</span>
                  <span className="font-bold text-slate-900">₩{formatWon(receiptItem.transportFee)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-extrabold text-slate-900">
                  <span>합계 총액:</span>
                  <span>₩{formatWon(receiptItem.expectedAmount)}</span>
                </div>
              </div>

              {/* Tax Deduction Details */}
              <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>공제 세율 ({receiptItem.taxRate}):</span>
                  <span>- ₩{formatWon(receiptItem.expectedAmount - receiptItem.netAmount)}</span>
                </div>
                {receiptItem.taxRate !== 'None' && (
                  <div className="flex flex-col gap-1 text-[10px] text-slate-500 pl-2 mt-1 border-l border-slate-200">
                    <div className="flex justify-between">
                      <span>소득세 (원천세):</span>
                      <span>₩{formatWon(Math.floor((receiptItem.expectedAmount - receiptItem.netAmount) * 0.909))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>지방소득세 (주민세):</span>
                      <span>₩{formatWon(Math.floor((receiptItem.expectedAmount - receiptItem.netAmount) * 0.091))}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Net Amount Receipt */}
              <div className="text-center pt-3 pb-1 border-t border-dashed border-slate-300">
                <span className="text-[10px] text-slate-400 block font-bold">실 수 령 액</span>
                <span className="text-2xl font-black text-[#10B981] tracking-tight block mt-1">
                  ₩{formatWon(receiptItem.netAmount)}
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
      
      {/* ── SETTINGS MODAL ── */}


    </div>
  );
}
