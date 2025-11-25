
function tokenizeFilename(filename) {
    // 按 _、.、-、空格 拆分，过滤空字符串
    return filename.split(/[_.-\s]/).filter(token => token);
}

function jaccardSimilarity(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = [...setA].filter(token => setB.has(token)).length;
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * 基于分词相似度聚类分组
 * @param {items[]} items - 待分组的文件名数组
 * @param {number} threshold - 相似度阈值
 * @returns {string[][]} 分组结果
 */
export function clusterByTokenSimilarity(items, threshold = 0.6) {
    const groups = [];
    // 预计算所有文件名的分词结果，避免重复计算
    const tokenized = items.map(item => ({
        item,
        tokens: tokenizeFilename(item.name)
    }));

    tokenized.forEach(({ item, tokens }) => {
        let bestGroupIndex = -1;
        let maxSimilarity = 0;

        groups.forEach((group, index) => {
            // 取分组中第一个文件的分词结果计算相似度（简化版，也可计算与所有文件的最大值）
            const groupFirstToken = tokenizeFilename(group[0].name);
            const similarity = jaccardSimilarity(tokens, groupFirstToken);
            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                bestGroupIndex = index;
            }
        });

        if (maxSimilarity >= threshold) {
            groups[bestGroupIndex].push(item);
        } else {
            groups.push([item]);
        }
    });

    return groups;
}

function levenshteinSimilarity(a, b) {
  const lenA = a.length;
  const lenB = b.length;

  // 初始化 DP 表
  const dp = Array.from({ length: lenA + 1 }, () => Array(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  // 填充 DP 表
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,    // 删除
        dp[i][j - 1] + 1,    // 插入
        dp[i - 1][j - 1] + cost // 替换
      );
    }
  }

  // 计算相似度（距离越小，相似度越大）
  const maxLen = Math.max(lenA, lenB);
  return maxLen === 0 ? 1 : 1 - dp[lenA][lenB] / maxLen;
}

export function clusterBySimilarity(items, threshold = 0.6) {
  const groups = [];

  items.forEach(item => {
    let bestGroupIndex = -1;
    let maxSimilarity = 0;

    // 检查当前文件与已有分组的相似度
    groups.forEach((group, index) => {
      // 取分组中与当前文件相似度最高的那个文件的相似度
      const groupSimilarity = Math.max(
        ...group.map(file => levenshteinSimilarity(item.name, file.name))
      );
      if (groupSimilarity > maxSimilarity) {
        maxSimilarity = groupSimilarity;
        bestGroupIndex = index;
      }
    });

    // 如果最大相似度超过阈值，加入对应分组；否则创建新分组
    if (maxSimilarity >= threshold) {
      groups[bestGroupIndex].push(item);
    } else {
      groups.push([item]);
    }
  });

  return groups;
}
