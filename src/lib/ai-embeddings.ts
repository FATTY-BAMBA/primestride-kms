import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate embedding for text
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

// Calculate cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// K-means clustering for grouping similar documents
export function kMeansClustering(
  embeddings: { id: string; embedding: number[] }[],
  k: number = 3,
  maxIterations: number = 10
): { clusters: Map<number, string[]>; centroids: number[][] } {
  if (embeddings.length === 0) {
    return { clusters: new Map(), centroids: [] };
  }

  if (k > embeddings.length) {
    k = embeddings.length;
  }

  const dim = embeddings[0].embedding.length;

  // Initialize centroids randomly
  let centroids = embeddings
    .slice(0, k)
    .map((e) => [...e.embedding]);

  let clusters = new Map<number, string[]>();

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign points to nearest centroid
    clusters = new Map();
    for (let i = 0; i < k; i++) {
      clusters.set(i, []);
    }

    embeddings.forEach((item) => {
      let minDist = Infinity;
      let closestCluster = 0;

      centroids.forEach((centroid, clusterIdx) => {
        const dist = 1 - cosineSimilarity(item.embedding, centroid);
        if (dist < minDist) {
          minDist = dist;
          closestCluster = clusterIdx;
        }
      });

      clusters.get(closestCluster)?.push(item.id);
    });

    // Update centroids
    const newCentroids: number[][] = [];
    for (let i = 0; i < k; i++) {
      const clusterIds = clusters.get(i) || [];
      if (clusterIds.length === 0) {
        newCentroids.push(centroids[i]);
        continue;
      }

      const clusterEmbeddings = clusterIds.map((id) =>
        embeddings.find((e) => e.id === id)!.embedding
      );

      const newCentroid = new Array(dim).fill(0);
      clusterEmbeddings.forEach((emb) => {
        emb.forEach((val, idx) => {
          newCentroid[idx] += val;
        });
      });

      newCentroid.forEach((val, idx) => {
        newCentroid[idx] /= clusterEmbeddings.length;
      });

      newCentroids.push(newCentroid);
    }

    centroids = newCentroids;
  }

  return { clusters, centroids };
}