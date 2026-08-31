/**
 * 随机演示数据生成器：随机中文姓名 + 合理属性分布
 */
import { createStudent } from './models.js';
import { mulberry32, shuffle } from './rng.js';
import { DUTIES } from './constants.js';

const SURNAMES = [
  '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高',
  '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹',
  '彭', '曾', '肖', '田', '董', '潘', '袁', '蔡', '蒋', '余',
  '杜', '叶', '程', '苏', '魏', '吕', '丁', '任', '沈', '姚',
];

const GIVEN_CHARS = [
  '伟', '芳', '娜', '敏', '静', '磊', '军', '洋', '勇', '艳',
  '杰', '涛', '明', '超', '秀英', '霞', '平', '刚', '桂英', '文',
  '涵', '轩', '宇', '欣', '怡', '子', '紫', '雨', '诗', '琪',
  '浩', '然', '子涵', '梓', '萱', '睿', '泽', '俊', '彤', '璐',
  '晨', '曦', '嘉', '懿', '致远', '天', '思', '慧', '雅', '琪',
];

function weightedPick(rng, items) {
  // items: [[value, weight], ...]
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}

function genNames(n, rng) {
  const names = new Set();
  let guard = 0;
  while (names.size < n && guard++ < n * 50) {
    const sur = SURNAMES[Math.floor(rng() * SURNAMES.length)];
    const g1 = GIVEN_CHARS[Math.floor(rng() * GIVEN_CHARS.length)];
    const twoChar = rng() < 0.45;
    const name = twoChar
      ? sur + g1 + GIVEN_CHARS[Math.floor(rng() * GIVEN_CHARS.length)]
      : sur + g1;
    if (name.length >= 2) names.add(name);
  }
  return [...names];
}

/**
 * 生成 n 名随机学生
 * @returns {students: [], nextId: number}
 */
export function generateDemoStudents(n, seed = Date.now() % 100000) {
  const rng = mulberry32(seed);
  const count = Math.min(80, Math.max(1, Math.round(n)));
  const names = genNames(count, rng);
  const students = [];
  const dutyPool = shuffle([...DUTIES], rng);
  let dutyIdx = 0;

  names.forEach((name, i) => {
    const gender = rng() < 0.5 ? '男' : '女';
    const height = weightedPick(rng, [['矮', 25], ['中', 50], ['高', 25]]);
    const vision = weightedPick(rng, [['近视', 35], ['正常', 45], ['良好', 20]]);
    const academic = weightedPick(rng, [['优秀', 20], ['良好', 40], ['中等', 30], ['待提高', 10]]);
    const personality = weightedPick(rng, [
      ['活跃', 20], ['安静', 25], ['调皮', 15], ['文静', 15], ['领导', 10], ['助人', 15],
    ]);
    const ability = rng() < 0.25 ? '' : weightedPick(rng, [
      ['学习', 20], ['体育', 15], ['艺术', 8], ['组织', 6], ['帮助', 10], ['需要', 8],
      ['音乐', 7], ['美术', 6], ['书法', 5], ['演讲', 6], ['朗诵', 4], ['舞蹈', 5], ['棋类', 4],
      ['英语口语', 4], ['科学实验', 4], ['信息技术', 4], ['劳动实践', 5],
    ]);
    // 约 18% 学生带一个职务（职务不重复）
    const tags = (rng() < 0.18 && dutyIdx < dutyPool.length) ? [dutyPool[dutyIdx++]] : [];
    // 标注：10% 重点关注 / 8% 需要注意 / 8% 表现良好 / 4% 特殊
    const annoRoll = rng();
    const annotationColor = annoRoll < 0.10 ? 'red'
      : annoRoll < 0.18 ? 'orange'
      : annoRoll < 0.26 ? 'green'
      : annoRoll < 0.30 ? 'purple' : null;

    students.push(createStudent({
      id: i + 1,
      name, gender, height, vision, academic, personality, ability, tags, annotationColor,
    }));
  });
  return { students, nextId: students.length + 1 };
}
