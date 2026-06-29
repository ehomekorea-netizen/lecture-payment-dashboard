import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Calendar, MapPin, TrendingUp, AlertCircle, 
  CheckCircle2, X, Download, Upload, Trash2, Edit3, Check, Info,
  Settings, Sparkles, Database, RefreshCw, Home, BarChart, 
   BookOpen, Copy
} from 'lucide-react';
import { INSTITUTION_COORDINATES, INITIAL_LECTURES } from './initialData';

// 두 좌표 간의 거리 계산 (Haversine 공식)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// 통화(원화) 안전 포맷터
function formatWon(val) {
  return (Number(val) || 0).toLocaleString();
}

export default function App() {
  // 모바일 앱용 탭 상태 ('home', 'stats', 'sync', 'settings')
  const [activeTab, setActiveTab] = useState('home');

  // 강의 데이터 상태
  const [lectures, setLectures] = useState(() => {
    try {
      const saved = localStorage.getItem('lectures');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(l => l && typeof l === 'object');
        }
      }
    } catch (e) {
      console.error("Failed to parse cached lectures", e);
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

  // GPS 관련 상태
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState(null);

  // AI 및 설정 관련 상태
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('google_sheet_url') || '');
  const [copiedCode, setCopiedCode] = useState(false);
  
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [parsedLectures, setParsedLectures] = useState([]);
  const [isAiVerifying, setIsAiVerifying] = useState(false);

  // 구글 시트 동기화 로딩 상태
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // 모달 폼 상태
  const [formData, setFormData] = useState({
    institution: '',
    rate: 100000,
    classes: 2,
    transportFee: 0,
    month: '',
    date: '',
    registrationDate: new Date().toISOString().slice(0, 10),
    isPaid: false,
    taxRate: '8.8%',
    taxBase: 'LectureOnly',
    customTax: 0
  });

  // 로컬 스토리지 데이터 동기화
  useEffect(() => {
    localStorage.setItem('lectures', JSON.stringify(lectures));
  }, [lectures]);

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
  const uniqueMonths = Array.from(new Set(lectures.map(l => l?.month).filter(Boolean))).sort((a, b) => {
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
        const matchedPreset = INSTITUTION_COORDINATES.find(c => c.name === value);
        if (matchedPreset) {
          updated.rate = matchedPreset.defaultRate;
          updated.transportFee = matchedPreset.defaultTransport;
          updated.taxRate = matchedPreset.defaultTax;
        } else {
          const prevLecture = lectures.find(l => l.institution === value);
          if (prevLecture) {
            updated.rate = prevLecture.rate;
            updated.transportFee = prevLecture.transportFee;
            updated.taxRate = prevLecture.taxRate;
            updated.taxBase = prevLecture.taxBase || 'LectureOnly';
          }
        }
      }

      return updated;
    });
  };

  // GPS 기준 매핑
  const handleGetLocation = () => {
    setGpsLoading(true);
    setGpsMessage(null);

    if (!navigator.geolocation) {
      setGpsMessage({ type: 'error', text: '브라우저 GPS 미지원' });
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        let closest = null;
        let minDistance = Infinity;

        INSTITUTION_COORDINATES.forEach(inst => {
          const dist = getDistance(latitude, longitude, inst.lat, inst.lng);
          if (dist < minDistance) {
            minDistance = dist;
            closest = inst;
          }
        });

        if (closest && minDistance < 800) {
          setFormData(prev => ({
            ...prev,
            institution: closest.name,
            rate: closest.defaultRate,
            transportFee: closest.defaultTransport,
            taxRate: closest.defaultTax
          }));
          setGpsMessage({
            type: 'success',
            text: `[감지] '${closest.name}' 근처(${Math.round(minDistance)}m)에 있어 자동 완성되었습니다.`
          });
        } else {
          setGpsMessage({
            type: 'warning',
            text: `주변 800m 이내에 지정된 기관이 없습니다. (가장 가까운 곳: ${closest ? closest.name : '없음'})`
          });
        }
        setGpsLoading(false);
      },
      (error) => {
        console.error(error);
        setGpsMessage({ type: 'error', text: '위치 정보 획득 실패 (GPS 권한을 허용해 주세요)' });
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 설정 저장
  const handleSaveSettings = (geminiKey, sheetApiUrl) => {
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('google_sheet_url', sheetApiUrl);
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
    if (!formData.institution.trim()) return;

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
    const monthVal = formData.month || `${now.getMonth() + 1}월`;
    const dateVal = formData.date || `${now.getMonth() + 1}월 ${now.getDate()}일`;

    const newLecture = {
      id: editingLecture ? editingLecture.id : String(Date.now()),
      institution: formData.institution,
      rate: Number(formData.rate),
      classes: Number(formData.classes),
      expectedAmount,
      transportFee: Number(formData.transportFee),
      deduction,
      netAmount,
      month: monthVal,
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
    setGpsMessage(null);
    setFormData({
      institution: '',
      rate: 100000,
      classes: 2,
      transportFee: 0,
      month: '',
      date: '',
      registrationDate: new Date().toISOString().slice(0, 10),
      isPaid: false,
      taxRate: '8.8%',
      taxBase: 'LectureOnly',
      customTax: 0
    });
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
    setGpsMessage(null);
    setIsAddModalOpen(true);
  };

  // CSV 내보내기
  const handleExportCSV = () => {
    const headers = ['기관명/학교', '강의단가', '총 차시', '예상수령액', '교통비(+)', '공제금액(-)', '월', '실수령액', '날짜', '등록일', '정산여부'];
    const rows = lectures.map(l => [
      l.institution,
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

        if (cleanFields.length < 7) continue;

        const inst = cleanFields[0];
        const rate = Number(cleanFields[1]) || 0;
        const classes = Number(cleanFields[2]) || 0;
        const expected = Number(cleanFields[3]) || 0;
        const transport = Number(cleanFields[4]) || 0;
        const deduction = Number(cleanFields[5]) || 0;
        const month = cleanFields[6];
        const net = cleanFields[7] ? Number(cleanFields[7]) : 0;
        const date = cleanFields[8] || '';
        const regDate = cleanFields[9] || new Date().toISOString().slice(0, 10);
        const isPaid = cleanFields[10] === '정산완료' || net > 0;

        newLectures.push({
          id: `csv-${Date.now()}-${i}`,
          institution: inst,
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

  // 통계 계산
  const totalExpected = lectures.reduce((acc, curr) => acc + curr.expectedAmount, 0);
  const totalNet = lectures.reduce((acc, curr) => acc + curr.netAmount, 0);
  const totalUnpaid = lectures.reduce((acc, curr) => acc + (curr.isPaid ? 0 : curr.expectedAmount), 0);
  const unpaidCount = lectures.filter(l => !l.isPaid).length;

  // 차트 집계
  const chartData = uniqueMonths.map(m => {
    const monthItems = lectures.filter(l => l.month === m);
    const paidTotal = monthItems.reduce((acc, curr) => acc + (curr.isPaid ? curr.netAmount : 0), 0);
    const unpaidTotal = monthItems.reduce((acc, curr) => acc + (curr.isPaid ? 0 : curr.expectedAmount), 0);
    return {
      month: m,
      paid: paidTotal,
      unpaid: unpaidTotal,
      total: paidTotal + unpaidTotal
    };
  });

  const maxChartValue = Math.max(...chartData.map(d => d.total), 100000);

  const filteredLectures = lectures.filter(l => {
    if (!l) return false;
    const inst = l.institution || '';
    const matchesSearch = inst.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMonth = selectedMonth === 'All' || l.month === selectedMonth;
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
    <div className="min-h-screen bg-[#F8FAF8] text-toss-textDark font-sans antialiased">
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
      <div className="flex md:hidden flex-col min-h-screen pb-20">
        {/* App Title Header */}
        <div className="bg-[#1F2E5B] text-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <span className="bg-white/10 p-1.5 rounded-xl">
              <TrendingUp size={16} className="text-toss-teal" />
            </span>
            <div>
              <h1 className="text-xs font-black tracking-tight">Lectoss DX</h1>
              <p className="text-[8px] text-white/70">프리랜서 강사용 정산비서</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => {
                setAiText('');
                setAiError(null);
                setParsedLectures([]);
                setIsAiVerifying(false);
                setIsAiModalOpen(true);
              }}
              className="bg-white/10 p-2 rounded-xl text-toss-teal"
              title="AI 일정 등록"
            >
              <Sparkles size={14} />
            </button>
            <button 
              onClick={() => {
                setEditingLecture(null);
                setFormData({
                  institution: '',
                  rate: 100000,
                  classes: 2,
                  transportFee: 0,
                  month: '',
                  date: '',
                  registrationDate: new Date().toISOString().slice(0, 10),
                  isPaid: false,
                  taxRate: '8.8%',
                  taxBase: 'LectureOnly',
                  customTax: 0
                });
                setGpsMessage(null);
                setIsAddModalOpen(true);
              }}
              className="bg-toss-teal text-[#1F2E5B] p-2 rounded-xl font-bold"
              title="강의 추가"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Dynamic Tab Body */}
        <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
          
          {/* TAB 1: HOME (Lectures Card List) */}
          {activeTab === 'home' && (
            <>
              {/* Filters Box */}
              <div className="bg-white p-3 rounded-[20px] border border-toss-border shadow-sm flex flex-col gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 text-toss-textSub" size={15} />
                  <input 
                    type="text" 
                    placeholder="교육 기관명 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-toss-border rounded-xl text-xs bg-[#F8FAF8]"
                  />
                </div>
                <div className="flex gap-1 overflow-x-auto py-0.5 scrollbar-none">
                  <button 
                    onClick={() => setSelectedMonth('All')}
                    className={`text-[9px] font-bold px-2.5 py-1 rounded-lg ${selectedMonth === 'All' ? 'bg-[#1F2E5B] text-white' : 'bg-gray-100 text-toss-textSub'}`}
                  >
                    전체 월
                  </button>
                  {uniqueMonths.map((m, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setSelectedMonth(m)}
                      className={`text-[9px] font-bold px-2.5 py-1 rounded-lg ${selectedMonth === m ? 'bg-[#1F2E5B] text-white' : 'bg-gray-100 text-toss-textSub'}`}
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
                  {filteredLectures.map((l) => (
                    <div key={l.id} className="bg-white p-4.5 rounded-[22px] border border-toss-border shadow-sm flex flex-col gap-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-bold bg-slate-100 text-toss-textSub px-2 py-0.5 rounded mb-1 inline-block">
                            {l.month} / {l.date}
                          </span>
                          <h3 className="text-xs font-extrabold text-toss-textDark">{l.institution}</h3>
                        </div>
                        <button
                          onClick={() => handleTogglePaid(l)}
                          className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${l.isPaid ? 'bg-green-50 border-green-200 text-toss-green' : 'bg-orange-50 border-orange-200 text-toss-amber'}`}
                        >
                          {l.isPaid ? '정산완료' : '정산대기'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-y-1.5 text-[10px] text-toss-textSub py-2 border-y border-dashed border-toss-border/60">
                        <div className="flex justify-between pr-2">
                          <span>단가×차시:</span>
                          <span className="font-semibold text-toss-textDark">₩{formatWon(l.rate)}×{l.classes}</span>
                        </div>
                        <div className="flex justify-between pl-2 border-l border-toss-border">
                          <span>예상수령:</span>
                          <span className="font-bold text-toss-textDark">₩{formatWon(l.expectedAmount)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-bold text-toss-textMuted">
                          실수령액: <strong className="text-xs font-black text-toss-blue">{l.isPaid ? `₩${formatWon(l.netAmount)}` : '-'}</strong>
                        </span>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleEditClick(l)} className="p-1 hover:bg-slate-100 rounded text-toss-textSub">
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => handleDelete(l.id)} className="p-1 hover:bg-red-50 rounded text-toss-red">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB 2: STATS */}
          {activeTab === 'stats' && (
            <div className="flex flex-col gap-4">
              <div className="bg-white p-4 rounded-[20px] border border-toss-border shadow-sm">
                <span className="text-[10px] font-bold text-toss-textSub block mb-2">정산 누적액</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#F8FAF8] p-3 rounded-xl border border-toss-border">
                    <span className="text-[9px] text-toss-textSub block">수령 완료</span>
                    <strong className="text-xs font-bold text-toss-green">₩{formatWon(totalNet)}</strong>
                  </div>
                  <div className="bg-[#F8FAF8] p-3 rounded-xl border border-toss-border">
                    <span className="text-[9px] text-toss-textSub block">대기 중</span>
                    <strong className="text-xs font-bold text-toss-amber">₩{formatWon(totalUnpaid)}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-[20px] border border-toss-border shadow-sm">
                <span className="text-[10px] font-bold text-toss-textSub block mb-4">월별 수령 추이</span>
                {chartData.length === 0 ? (
                  <div className="text-[10px] text-toss-textSub text-center py-10">내역이 없습니다.</div>
                ) : (
                  <div className="h-44 flex items-end justify-between px-2 pt-6 border-b border-toss-border">
                    {chartData.map((d, idx) => {
                      const totalHeightPercent = (d.total / maxChartValue) * 110;
                      const paidHeight = (d.paid / d.total) * totalHeightPercent || 0;
                      const unpaidHeight = (d.unpaid / d.total) * totalHeightPercent || 0;

                      return (
                        <div key={idx} className="flex flex-col items-center flex-1">
                          <div className="w-5 flex flex-col justify-end items-center rounded-t overflow-hidden" style={{ height: `${Math.max(totalHeightPercent, 4)}px` }}>
                            {d.unpaid > 0 && <div className="w-full chart-unpaid-pattern" style={{ height: `${unpaidHeight}px` }} />}
                            {d.paid > 0 && <div className="w-full bg-[#1F2E5B]" style={{ height: `${paidHeight}px` }} />}
                          </div>
                          <span className="text-[9px] font-bold text-toss-textSub mt-2">{d.month}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SYNC */}
          {activeTab === 'sync' && (
            <div className="flex flex-col gap-4">
              <div className="bg-white p-4 rounded-[20px] border border-toss-border shadow-sm flex flex-col gap-3">
                <h3 className="text-xs font-extrabold text-toss-textDark flex items-center gap-1">
                  <Database size={13} className="text-toss-blue" />
                  구글 스프레드시트 클라우드 백업
                </h3>

                {!sheetUrl ? (
                  <div className="p-3 bg-orange-50 border border-orange-200 text-toss-amber rounded-xl text-[10px] leading-relaxed">
                    [환경 설정] 탭에 본인의 <strong>구글 시트 웹 앱 URL</strong>을 연동하면 클라우드 실시간 백업이 활성화됩니다.
                  </div>
                ) : (
                  <>
                    {syncMessage && (
                      <div className={`p-2.5 rounded-xl border text-[10px] ${syncMessage.type === 'success' ? 'bg-green-50 border-green-200 text-toss-green' : 'bg-red-50 border-red-200 text-toss-red'}`}>
                        {syncMessage.text}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 mt-1">
                      <button
                        onClick={fetchFromGoogleSheet}
                        disabled={syncLoading}
                        className="w-full py-2.5 text-xs font-bold bg-blue-50 border border-blue-100 text-toss-blue rounded-xl flex items-center justify-center gap-1 hover:bg-blue-100"
                      >
                        {syncLoading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                        시트 데이터 불러오기 (Pull)
                      </button>
                      <button
                        onClick={() => syncToGoogleSheet(lectures)}
                        disabled={syncLoading}
                        className="w-full py-2.5 text-xs font-bold bg-[#1F2E5B] text-white rounded-xl flex items-center justify-center gap-1 hover:bg-[#172346]"
                      >
                        {syncLoading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                        시트에 데이터 백업하기 (Push)
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white p-4 rounded-[20px] border border-toss-border shadow-sm flex flex-col gap-2.5">
                <span className="text-xs font-extrabold text-toss-textDark">로컬 파일 내보내기/가져오기</span>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleExportCSV} className="py-2 bg-slate-100 text-toss-textDark text-[10px] font-bold rounded-xl flex items-center justify-center gap-1">
                    <Download size={12} /> CSV 다운로드
                  </button>
                  <label className="py-2 bg-slate-100 text-toss-textDark text-[10px] font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer text-center">
                    <Upload size={12} /> CSV 업로드
                    <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="flex flex-col gap-4">
              <div className="bg-white p-4 rounded-[20px] border border-toss-border shadow-sm flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-bold text-toss-textSub block mb-1">Gemini AI API Key</label>
                  <input 
                    type="password"
                    id="settings-api-key-mobile"
                    defaultValue={apiKey}
                    className="w-full px-3 py-2 border border-toss-border rounded-xl text-xs bg-[#F8FAF8]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-toss-textSub block mb-1">구글 시트 웹 앱 URL</label>
                  <input 
                    type="text"
                    id="settings-sheet-url-mobile"
                    defaultValue={sheetUrl}
                    className="w-full px-3 py-2 border border-toss-border rounded-xl text-xs bg-[#F8FAF8]"
                  />
                </div>
                <button
                  onClick={() => {
                    const geminiKey = document.getElementById('settings-api-key-mobile').value;
                    const sheetApiUrl = document.getElementById('settings-sheet-url-mobile').value;
                    handleSaveSettings(geminiKey, sheetApiUrl);
                  }}
                  className="w-full py-2.5 text-xs font-bold bg-[#1F2E5B] text-white rounded-xl hover:bg-[#172346]"
                >
                  설정 저장
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 p-4 rounded-[20px] flex flex-col gap-2">
                <span className="text-xs font-bold text-toss-red">전체 초기화</span>
                <p className="text-[9px] text-toss-textSub leading-relaxed">
                  브라우저에 보관된 모든 설정과 출강 내역을 삭제하고 기본 빈 상태로 리셋합니다.
                </p>
                <button
                  onClick={() => {
                    if (window.confirm('정말 전체 리셋하시겠습니까?')) {
                      localStorage.clear();
                      setLectures([]);
                      setApiKey('');
                      setSheetUrl('');
                      alert('리셋되었습니다.');
                    }
                  }}
                  className="py-2 text-[10px] font-bold bg-toss-red text-white rounded-xl"
                >
                  기기 데이터 전체 삭제
                </button>
              </div>
            </div>
          )}

        </div>

        {/* iOS-style Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-toss-border flex items-center justify-around py-3 px-4 z-40 shadow-lg">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-0.5 text-[9px] font-extrabold ${activeTab === 'home' ? 'text-toss-blue scale-105' : 'text-toss-textSub'}`}>
            <Home size={18} />
            <span>기록</span>
          </button>
          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-0.5 text-[9px] font-extrabold ${activeTab === 'stats' ? 'text-toss-blue scale-105' : 'text-toss-textSub'}`}>
            <BarChart size={18} />
            <span>정산 분석</span>
          </button>
          <button onClick={() => setActiveTab('sync')} className={`flex flex-col items-center gap-0.5 text-[9px] font-extrabold ${activeTab === 'sync' ? 'text-toss-blue scale-105' : 'text-toss-textSub'}`}>
            <RefreshCw size={18} />
            <span>연동 백업</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-0.5 text-[9px] font-extrabold ${activeTab === 'settings' ? 'text-toss-blue scale-105' : 'text-toss-textSub'}`}>
            <Settings size={18} />
            <span>설정</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          [DESKTOP SCREEN VIEW] - Renders on desktop screens (>= 768px)
         ======================================================== */}
      <div className="hidden md:flex flex-col gap-6 max-w-5xl mx-auto py-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-toss-border">
          <div>
            <h1 className="text-xl font-black text-toss-textDark flex items-center gap-2">
              <span className="bg-[#1F2E5B] text-white p-1.5 rounded-xl">
                <TrendingUp size={20} />
              </span>
              Lectoss <span className="text-xs bg-blue-50 text-toss-blue px-2 py-0.5 rounded-full border border-blue-100 font-bold">사회복지 강사용 정산비서 (PC버전)</span>
            </h1>
            <p className="text-xs text-toss-textSub mt-1">프리랜서 강사를 위한 개인 클라우드 연동 출강료 통계 대시보드</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-white border border-toss-border text-toss-textSub rounded-xl hover:bg-slate-50 transition"
              title="API 환경 설정"
            >
              <Settings size={18} />
            </button>
            <button 
              onClick={() => {
                setAiText('');
                setAiError(null);
                setParsedLectures([]);
                setIsAiVerifying(false);
                setIsAiModalOpen(true);
              }}
              className="flex items-center gap-1 text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 px-3.5 py-2.5 rounded-xl hover:bg-indigo-100 transition"
            >
              <Sparkles size={14} />
              AI 카톡 일정 등록
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 text-xs font-bold bg-white border border-toss-border text-toss-textMuted px-3.5 py-2.5 rounded-xl hover:bg-slate-50 transition"
            >
              <Download size={14} /> CSV 내보내기
            </button>
            <label className="flex items-center gap-1 text-xs font-bold bg-white border border-toss-border text-toss-textMuted px-3.5 py-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer">
              <Upload size={14} /> CSV 불러오기
              <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
            </label>
            <button
              onClick={() => {
                setEditingLecture(null);
                setFormData({
                  institution: '',
                  rate: 100000,
                  classes: 2,
                  transportFee: 0,
                  month: '',
                  date: '',
                  registrationDate: new Date().toISOString().slice(0, 10),
                  isPaid: false,
                  taxRate: '8.8%',
                  taxBase: 'LectureOnly',
                  customTax: 0
                });
                setGpsMessage(null);
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-1 text-xs font-bold bg-[#1F2E5B] text-white px-4.5 py-2.5 rounded-xl hover:bg-[#172346] transition"
            >
              <Plus size={16} /> 새 강의 기록
            </button>
          </div>
        </div>

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

        {/* Statistics Widgets */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[24px] border border-toss-border shadow-sm">
            <span className="text-xs font-semibold text-toss-textSub block mb-1">정산 완료액 (실수령 완료)</span>
            <div className="text-2xl font-black text-toss-textDark">₩{formatWon(totalNet)}</div>
          </div>
          <div className="bg-white p-6 rounded-[24px] border border-toss-border shadow-sm">
            <span className="text-xs font-semibold text-toss-textSub block mb-1">총 예상 수령액 (대기 포함)</span>
            <div className="text-2xl font-black text-toss-textDark">₩{formatWon(totalExpected)}</div>
          </div>
          <div className="bg-white p-6 rounded-[24px] border border-toss-border shadow-sm bg-orange-50/20 border-orange-100">
            <span className="text-xs font-semibold text-toss-textSub block mb-1">미정산(정산대기) 총액</span>
            <div className="text-2xl font-black text-toss-amber">₩{formatWon(totalUnpaid)}</div>
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
                        {d.unpaid > 0 && <div className="w-full chart-unpaid-pattern" style={{ height: `${unpaidHeight}px` }} />}
                        {d.paid > 0 && <div className="w-full bg-[#1F2E5B]" style={{ height: `${paidHeight}px` }} />}
                      </div>
                      <span className="text-[10px] font-bold text-toss-textSub mt-2">{d.month}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Table right columns */}
          <div className="col-span-2 bg-white rounded-[24px] border border-toss-border shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-toss-border flex items-center justify-between bg-slate-50/50">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2 text-toss-textSub" size={16} />
                <input 
                  type="text" 
                  placeholder="교육 기관 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-toss-border rounded-xl text-xs bg-white"
                />
              </div>

              <div className="flex gap-2">
                <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-[11px] font-semibold bg-white border border-toss-border text-toss-textMuted px-2.5 py-1.5 rounded-lg"
                >
                  <option value="All">전체 월</option>
                  {uniqueMonths.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                </select>
                <select 
                  value={selectedStatus} 
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="text-[11px] font-semibold bg-white border border-toss-border text-toss-textMuted px-2.5 py-1.5 rounded-lg"
                >
                  <option value="All">전체 정산상태</option>
                  <option value="Paid">정산 완료</option>
                  <option value="Pending">정산 대기</option>
                </select>
              </div>
            </div>

            {/* Desktop Table body */}
            {filteredLectures.length === 0 ? (
              <div className="py-20 text-center text-xs text-toss-textSub">검색 결과가 없습니다.</div>
            ) : (
              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-toss-border bg-slate-50/20 text-toss-textSub font-bold">
                      <th className="px-4 py-3">교육 기관명</th>
                      <th className="px-3 py-3 text-right">단가 × 시간</th>
                      <th className="px-3 py-3 text-right">예상액</th>
                      <th className="px-3 py-3 text-right">교통비</th>
                      <th className="px-3 py-3 text-right">공제</th>
                      <th className="px-3 py-3 text-right">실수령액</th>
                      <th className="px-3 py-3 text-center">출강 기간 (월)</th>
                      <th className="px-4 py-3 text-center">정산상태</th>
                      <th className="px-4 py-3 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-toss-border">
                    {filteredLectures.map((lecture) => (
                      <tr key={lecture.id} className="hover:bg-slate-50/40 transition">
                        <td className="px-4 py-3 font-bold text-toss-textDark">{lecture.institution}</td>
                        <td className="px-3 py-3 text-right font-medium text-toss-textSub">
                          ₩{formatWon(lecture.rate)} × {lecture.classes}h
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-toss-textMuted">
                          ₩{formatWon(lecture.expectedAmount)}
                        </td>
                        <td className="px-3 py-3 text-right text-toss-textSub">
                          {lecture.transportFee > 0 ? `₩${formatWon(lecture.transportFee)}` : '-'}
                        </td>
                        <td className="px-3 py-3 text-right text-toss-red font-medium">
                          {lecture.isPaid && lecture.deduction !== 0 ? `₩${formatWon(lecture.deduction)}` : '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-toss-blue">
                          {lecture.isPaid ? `₩${formatWon(lecture.netAmount)}` : '-'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="font-semibold text-toss-textMuted">{lecture.month}</div>
                          <div className="text-[10px] text-toss-textSub mt-0.5">{lecture.date}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleTogglePaid(lecture)}
                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${lecture.isPaid ? 'bg-green-50 border-green-200 text-toss-green' : 'bg-orange-50 border-orange-200 text-toss-amber'}`}
                          >
                            {lecture.isPaid ? '정산완료' : '정산대기'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleEditClick(lecture)} className="p-1 hover:bg-slate-100 rounded text-toss-textSub">
                              <Edit3 size={13} />
                            </button>
                            <button onClick={() => handleDelete(lecture.id)} className="p-1 hover:bg-red-50 rounded text-toss-red">
                              <Trash2 size={13} />
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
        <div className="bg-white p-6 rounded-[24px] border border-toss-border shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-toss-textDark flex items-center gap-1.5">
              <BookOpen size={15} />
              구글 시트 연동용 Google Apps Script 원본 코드
            </h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(gasTemplateCode);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="text-[11px] font-bold text-toss-blue flex items-center gap-1 hover:underline"
            >
              {copiedCode ? '복사되었습니다!' : '코드 클립보드 복사'}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[10px] font-mono leading-relaxed max-h-[140px] overflow-y-auto">
            {gasTemplateCode}
          </pre>
        </div>
      </div>

      {/* ========================================================
          [MODAL 3]: Add/Edit Lecture Modal (Desktop: centered / Mobile: Bottom Sheet)
         ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-[#191F28]/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-50 animate-fade-in">
          {/* Mobile: Bottom Sheet container, Desktop: Centered card container */}
          <div className="bg-white w-full md:max-w-md rounded-t-[32px] md:rounded-[28px] max-h-[90vh] md:max-h-none overflow-y-auto flex flex-col pb-8 md:pb-0 shadow-2xl transition-transform duration-300">
            {/* Drag handle for mobile */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3 md:hidden flex-shrink-0" />
            
            <div className="p-5 border-b border-toss-border flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-extrabold text-toss-textDark flex items-center gap-1.5">
                {editingLecture ? <Edit3 size={15} className="text-toss-blue" /> : <Plus size={15} className="text-toss-blue" />}
                {editingLecture ? '출강 기록 수정' : '새 강의 직접 기록'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-toss-textSub hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs">
              {/* GPS locator */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-toss-blue flex items-center gap-1">
                    <MapPin size={12} />
                    GPS 출강장소 매핑
                  </span>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={gpsLoading}
                    className="bg-toss-blue hover:bg-toss-blueHover text-white px-3 py-1.5 rounded-lg font-bold transition"
                  >
                    {gpsLoading ? '감지 중...' : '현재 위치 감지'}
                  </button>
                </div>
                {gpsMessage && (
                  <div className={`p-2 rounded-lg border text-[10px] ${gpsMessage.type === 'success' ? 'bg-green-50 border-green-200 text-toss-green' : 'bg-orange-50 border-orange-200 text-toss-amber'}`}>
                    {gpsMessage.text}
                  </div>
                )}
              </div>

              {/* Institution */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-toss-textMuted">기관 / 교육장명 *</label>
                <input 
                  type="text" 
                  name="institution"
                  required
                  value={formData.institution}
                  onChange={handleInputChange}
                  placeholder="예: 사회복지협의회/목포경애원"
                  list="presets-modal"
                  className="px-3 py-2 border border-toss-border rounded-xl focus:outline-none focus:border-toss-blue bg-white"
                />
                <datalist id="presets-modal">
                  {uniqueInstitutions.map((i, idx) => <option key={idx} value={i} />)}
                </datalist>
              </div>

              {/* Rate & Classes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-toss-textMuted">강의 단가 (시간당) *</label>
                  <input 
                    type="number" 
                    name="rate"
                    required
                    value={formData.rate}
                    onChange={handleInputChange}
                    className="px-3 py-2 border border-toss-border rounded-xl focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-toss-textMuted">총 강의 시간 (차시) *</label>
                  <input 
                    type="number" 
                    name="classes"
                    required
                    value={formData.classes}
                    onChange={handleInputChange}
                    className="px-3 py-2 border border-toss-border rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Transport & Month */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-toss-textMuted">추가 교통비 (원)</label>
                  <input 
                    type="number" 
                    name="transportFee"
                    value={formData.transportFee}
                    onChange={handleInputChange}
                    className="px-3 py-2 border border-toss-border rounded-xl focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-toss-textMuted">정산 월 *</label>
                  <input 
                    type="text" 
                    name="month"
                    required
                    placeholder="예: 11월"
                    value={formData.month}
                    onChange={handleInputChange}
                    className="px-3 py-2 border border-toss-border rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Date & RegDate */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-toss-textMuted">구체적 날짜 *</label>
                  <input 
                    type="text" 
                    name="date"
                    required
                    placeholder="예: 11월 19일"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="px-3 py-2 border border-toss-border rounded-xl focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-toss-textMuted">게시등록일 *</label>
                  <input 
                    type="date" 
                    name="registrationDate"
                    required
                    value={formData.registrationDate}
                    onChange={handleInputChange}
                    className="px-3 py-2 border border-toss-border rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Tax settings */}
              <div className="p-3 bg-slate-50 border border-toss-border rounded-xl flex flex-col gap-2">
                <span className="font-bold text-toss-textDark">공제 세율 설정</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] text-toss-textSub">세율</label>
                    <select 
                      name="taxRate" 
                      value={formData.taxRate}
                      onChange={handleInputChange}
                      className="px-2.5 py-1.5 bg-white border border-toss-border rounded-lg"
                    >
                      <option value="8.8%">8.8% (기타소득)</option>
                      <option value="3.3%">3.3% (사업소득)</option>
                      <option value="None">세금 없음 (0%)</option>
                      <option value="Custom">직접 입력</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] text-toss-textSub">과세기준</label>
                    <select 
                      name="taxBase" 
                      value={formData.taxBase}
                      onChange={handleInputChange}
                      className="px-2.5 py-1.5 bg-white border border-toss-border rounded-lg"
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
                    className="px-3 py-1.5 border border-toss-border rounded-lg bg-white mt-1"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="modal-isPaid"
                  name="isPaid"
                  checked={formData.isPaid}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-toss-blue border-toss-border rounded cursor-pointer"
                />
                <label htmlFor="modal-isPaid" className="font-bold text-toss-textMuted cursor-pointer select-none">
                  이미 강의료 입금이 완료되었습니다.
                </label>
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-toss-textMuted font-bold rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#1F2E5B] hover:bg-[#172346] text-white font-bold rounded-xl shadow-md"
                >
                  {editingLecture ? '기록 수정' : '기록 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          [MODAL 4]: AI Scan Modal (Desktop: centered / Mobile: Bottom Sheet)
         ======================================================== */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-[#191F28]/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-50 animate-fade-in">
          <div className="bg-white w-full md:max-w-xl rounded-t-[32px] md:rounded-[28px] max-h-[90vh] overflow-y-auto flex flex-col pb-8 md:pb-0 shadow-2xl transition-transform duration-300">
            {/* drag handle for mobile */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3 md:hidden flex-shrink-0" />

            <div className="p-5 border-b border-toss-border flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-extrabold text-toss-textDark flex items-center gap-1.5">
                <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                {isAiVerifying ? 'AI 파싱 결과 검토 (이게 맞습니까?)' : 'AI 카톡 일정 등록'}
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

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-toss-textSub">정산 월</label>
                          <input 
                            type="text"
                            value={item.month}
                            onChange={(e) => handleParsedFieldChange(idx, 'month', e.target.value)}
                            className="px-2 py-1.5 border border-toss-border rounded-lg bg-white focus:outline-none"
                          />
                        </div>
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
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-toss-textMuted font-bold rounded-xl"
                  >
                    이전으로
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveParsedLectures}
                    className="flex-1 py-2.5 bg-[#1F2E5B] hover:bg-[#172346] text-white font-bold rounded-xl shadow-md"
                  >
                    데이터 일괄 등록
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================
          [MODAL 5]: Desktop API Settings Modal
         ======================================================== */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-[#191F28]/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[28px] border border-toss-border shadow-modal overflow-hidden flex flex-col">
            <div className="p-5 border-b border-toss-border flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-extrabold text-toss-textDark flex items-center gap-1.5">
                <Settings size={15} />
                대시보드 환경 설정 (PC)
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1 text-toss-textSub hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-toss-textMuted">Gemini API Key</label>
                <input 
                  type="password"
                  id="settings-api-key-desktop"
                  defaultValue={apiKey}
                  className="w-full px-3 py-2 border border-toss-border rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-toss-textMuted">구글 시트 웹 앱 URL</label>
                <input 
                  type="text"
                  id="settings-sheet-url-desktop"
                  defaultValue={sheetUrl}
                  className="w-full px-3 py-2 border border-toss-border rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('정말 전체 데이터를 초기화하시겠습니까?')) {
                      localStorage.clear();
                      setLectures([]);
                      setApiKey('');
                      setSheetUrl('');
                      setIsSettingsOpen(false);
                      alert('초기화 완료');
                    }
                  }}
                  className="py-2.5 px-3 bg-red-50 text-toss-red font-bold rounded-xl hover:bg-red-100"
                >
                  전체 초기화
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 text-toss-textMuted font-bold rounded-xl"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const geminiKey = document.getElementById('settings-api-key-desktop').value;
                    const sheetApiUrl = document.getElementById('settings-sheet-url-desktop').value;
                    handleSaveSettings(geminiKey, sheetApiUrl);
                    setIsSettingsOpen(false);
                  }}
                  className="py-2.5 px-4 bg-[#1F2E5B] text-white font-bold rounded-xl shadow-md"
                >
                  설정 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
