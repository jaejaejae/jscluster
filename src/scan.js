class GraphInfo {
  constructor(graph, setting) {
    this._nodeByIds = {};
    this.setting = setting ? setting : {};
    this.setting.useDirection = (this.setting.useDirection) ? this.setting.useDirection : false;
    this.init(graph);
  }

  init(graph) {
    for (let node of graph.nodes) {
      this._nodeByIds[node.id] = {
        neighbours: new Set()
      };
    }

    for (let edge of graph.edges) {
      const source = edge.source;
      const target = edge.target;

      this._nodeByIds[source].neighbours.add(target);
      if (!this.setting.useDirection) {
        this._nodeByIds[target].neighbours.add(source);
      }
    }
  }

  getNeighbours(nodeId) {
    return this._nodeByIds[nodeId].neighbours;
  }

  getCommonNeighbours(nodeId1, nodeId2) {
    const neighbours1 = this.getNeighbours(nodeId1),
      neighbours2 = this.getNeighbours(nodeId2);
    let neighbours = new Set();

    for (const neighbour1 of neighbours1) {
      if (neighbours2.has(neighbour1)) {
        neighbours.add(neighbour1);
      }
    }
    return neighbours;
  }

  getVertexStructure(nodeId) {
    let vertexStructure = new Set([...this.getNeighbours(nodeId)]);

    vertexStructure.add(nodeId);
    return vertexStructure;
  }

  getStructuralSimilarity(nodeId1, nodeId2) {
    let vertexStructure1 = this.getVertexStructure(nodeId1),
      vertexStructure2 = this.getVertexStructure(nodeId2);
    let commonVertexStructure = [...vertexStructure1].filter(node => vertexStructure2.has(node));

    return commonVertexStructure.length * 1.0 / Math.sqrt(vertexStructure1.size * vertexStructure2.size);
  }

  getEpsilonNeighbourhood(nodeId, epsilon) {
    let epsilonNeighbourhood = new Set();

    for (const neighbourId of this.getVertexStructure(nodeId)) {
      if (this.getStructuralSimilarity(neighbourId, nodeId) >= epsilon) {
        epsilonNeighbourhood.add(neighbourId);
      }
    }
    return epsilonNeighbourhood;
  }

  isCore(nodeId, epsilon, mu) {
    return this.getEpsilonNeighbourhood(nodeId, epsilon).size >= mu;
  }

  isDirectStructureReachable(v, w, epsilon, mu) {
    return this.isCore(v, epsilon, mu) && this.getEpsilonNeighbourhood(v).has(w);
  }

  getDirectStructureReachable(v, epsilon, mu) {
    if (!this.isCore(v, epsilon, mu)) {
      return [];
    }
    return this.getEpsilonNeighbourhood(v, epsilon);
  }

  isHub(v, clusterContainer) {
    let vertexStructure = this.getVertexStructure(v);
    let clusterIds = new Set();

    for (let x of vertexStructure) {
      let clusterId = clusterContainer.getCluster(x);

      if (clusterId !== undefined) {
        clusterIds.add(clusterId);
      }
    }
    return clusterIds.size > 1;
  }
}

class ClusterContainer {
  constructor() {
    this._byClusterIds = {};
    this._byNodeIds = {};
    this._hasClassified = new Set();
    this._hubs = [];
    this._outliers = [];
  }

  addHub(nodeId) {
    if (this._hasClassified.has(nodeId)) {
      console.warn(`${nodeId} has been previously classified before being set as hub.`);
    }
    this._hasClassified.add(nodeId);
    this._hubs.push(nodeId);
  }

  getHubs() {
    return this._hubs;
  }

  addOutlier(nodeId) {
    if (this._hasClassified.has(nodeId)) {
      console.warn(`${nodeId} has been previously classified before being set as outliers.`);
    }
    this._hasClassified.add(nodeId);
    this._outliers.push(nodeId);
  }

  getOutliers() {
    return this._outliers;
  }

  addNewCluster() {
    const newClusterId = Object.keys(this._byClusterIds).length;

    this._byClusterIds[newClusterId] = [];
    return newClusterId;
  }

  addToCluster(clusterId, nodeId) {
    if (this._hasClassified.has(nodeId)) {
      console.warn(`${nodeId} has been previously classified before added to cluster.`);
    }
    this._hasClassified.add(nodeId);
    this._byClusterIds[clusterId].push(nodeId);
    this._byNodeIds[nodeId] = clusterId;
  }

  getCluster(nodeId) {
    return this._byNodeIds[nodeId];
  }

  getOutput() {
    return {
      hubs: this.getHubs(),
      outliers: this.getOutliers(),
      byClusters: this._byClusterIds,
      byNodeIds: this._byNodeIds
    };
  }
}

const scanOriginal = (graph, epsilon, mu, setting) => {
  setting = setting === undefined ? {} : setting;

  let graphInfo = new GraphInfo(graph, setting);
  let coreNodeIds = new Set(
    graph.nodes
    .filter(node => graphInfo.isCore(node.id, epsilon, mu))
    .map(node => node.id));
  let nonMemberNodes = new Set();
  let clusterContainer = new ClusterContainer();

  for (let node of graph.nodes) {
    const v = node.id;

    if (clusterContainer.getCluster(v) !== undefined) {
      continue;
    }

    if (!coreNodeIds.has(v)) {
      nonMemberNodes.add(v);
      continue;
    }

    const newClusterId = clusterContainer.addNewCluster();

    let nodeQueue = [...graphInfo.getEpsilonNeighbourhood(v, epsilon)];

    while (nodeQueue.length > 0) {
      let y = nodeQueue[0];

      nodeQueue.shift();

      let reachableNodeIds = graphInfo.getDirectStructureReachable(y, epsilon, mu);

      for (let x of reachableNodeIds) {
        if (clusterContainer.getCluster(x) !== undefined) {
          continue;
        }

        clusterContainer.addToCluster(newClusterId, x);
        if (nonMemberNodes.has(x)) {
          nonMemberNodes.delete(x);
        }
        if (coreNodeIds.has(x)) {
          nodeQueue.push(x);
        }
      }
    }
  }

  for (let v of nonMemberNodes) {
    if (graphInfo.isHub(v, clusterContainer)) {
      clusterContainer.addHub(v);
    } else {
      clusterContainer.addOutlier(v);
    }
  }

  return clusterContainer.getOutput();
};

export {
  scanOriginal,
  GraphInfo,
  ClusterContainer
};
