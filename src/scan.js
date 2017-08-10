const NODE_STATUS = {
  UNCLASSIFIED: 'UNCLASSIFIED',
  NONMEMBER: 'NONMEMBER'
};

class NodeStatusContainer {
  constructor(graph) {
    this._nodeStatus = {};
    this._byStatuses = {};

    for (let status of Object.keys(NODE_STATUS)) {
      this._byStatuses[status] = new Set();
    }

    this.initNodeStatus(graph);
  }

  initNodeStatus(graph) {
    for (let node of graph.nodes) {
      this._nodeStatus[node.id] = NODE_STATUS.UNCLASSIFIED;
      this._byStatuses[NODE_STATUS.UNCLASSIFIED].add(node.id);
    }
  }

  hasNodeStatus(nodeStatus) {
    return this._byStatuses[nodeStatus].size > 0;
  }

  setStatus(nodeId, nodeStatus) {
    const previousStatus = this._nodeStatus[nodeId];

    this._byStatuses[previousStatus].delete(nodeId);
    this._byStatuses[nodeStatus].add(nodeId);
    this._nodeStatus[nodeId] = nodeStatus;
  }

  getNode(nodeStatus) {
    return this._byStatuses[nodeStatus].values().next().value;
  }

  getNodes(nodeStatus) {
    return [...this._byStatuses[nodeStatus].values()];
  }

  isStatus(nodeId, status) {
    return this._nodeStatus[nodeId] === status;
  }
}

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
    let count = 0;
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
    console.log('isCore');
    console.log(nodeId);
    console.log(mu);
    console.log(this.getEpsilonNeighbourhood(nodeId, epsilon));
    return this.getEpsilonNeighbourhood(nodeId, epsilon).size >= mu;
  }

  isDirectStructureReachable(v, w, epsilon, mu) {
    return this.isCore(v, epsilon, mu) && this.getEpsilonNeighbourhood(v).has(w);
  }

  getDirectStructureReachable(v, epsilon, mu) {
    if (!this.isCore(v, epsilon, mu)) {
      return [];
    }
    return this.getEpsilonNeighbourhood(v);
  }

  isHub(v, clusterContainer) {
    let vertexStructure = this.getVertexStructure(v);
    let clusterIds = new Set();

    for (let x of vertexStructure) {
      let clusterId = clusterContainer.getCluster(x);

      if (clusterId) {
        clusterIds.add(clusterId);
      }
    }
    return clusterIds;
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
}

/**
 * Implementing: Xu, Xiaowei, et al. 'Scan: a structural clustering
 * algorithm for networks.' Proceedings of the 13th ACM SIGKDD
 * international conference on Knowledge discovery and data mining. ACM, 2007.
 * @param {*} graph
 * @param {*} epsilon
 * @param {*} mu
 */
const scanOriginal = (graph, epsilon, mu, setting) => {
  let nodeStatus = new NodeStatusContainer(graph);
  let graphInfo = new GraphInfo(graph, setting);
  let clusterContainer = new ClusterContainer();

  while (nodeStatus.hasNodeStatus(NODE_STATUS.UNCLASSIFIED)) {
    let nodeId = nodeStatus.getNode(NODE_STATUS.UNCLASSIFIED);

    if (graphInfo.isCore(nodeId, epsilon, mu)) {
      const newClusterId = clusterContainer.addNewCluster();
      let nodeQueue = new Set(...graphInfo.getEpsilonNeighbourhood(nodeId));

      while (nodeQueue.lengh > 0) {
        const y = nodeQueue.values().next().value;
        let reachableNodes = graphInfo.getDirectStructureReachable(y, epsilon, mu);

        for (const x of reachableNodes) {
          if (nodeStatus.isStatus(x, NODE_STATUS.UNCLASSIFIED) || nodeStatus.isStatus(x, NODE_STATUS.NONMEMBER)) {
            clusterContainer.addToCluster(newClusterId, x);
          }
          if (nodeStatus.isStatus(x, NODE_STATUS.UNCLASSIFIED)) {
            nodeQueue.add(x);
          }
        }
      }
    } else {
      nodeStatus.setStatus(nodeId, NODE_STATUS.NONMEMBER);
    }
  }

  for (const nodeId of nodeStatus.getNodes(NODE_STATUS.NONMEMBER)) {
    if (graphInfo.isHub(nodeId)) {
      clusterContainer.addHub(nodeId);
    } else {
      clusterContainer.addOutlier(nodeId);
    }
  }

  return clusterContainer.getOutput();
};

export {
  scanOriginal,
  NODE_STATUS,
  NodeStatusContainer,
  GraphInfo
};
