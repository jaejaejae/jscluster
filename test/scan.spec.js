import {
  Scan
} from '../src/index.js';
import chai from 'chai';

chai.expect();

const expect = chai.expect;
const assert = chai.assert;

let graph, allNodeIds, graphInfo;

function createGraph(totalNodes) {
  let graph = {};

  graph.nodes = [];
  for (let i = 0; i < totalNodes; ++i) {
    graph.nodes.push({
      id: i
    });
  }
  return graph;
}

describe('When I initialise NodeStatusContainer', () => {
  before(() => {
    graph = createGraph(5);
    allNodeIds = graph.nodes.map(node => node.id);
  });
  it('should put all nodes as unclassified', () => {
    let nodeStatusContainer = new Scan.NodeStatusContainer(graph);

    expect(nodeStatusContainer.hasNodeStatus(Scan.NODE_STATUS.UNCLASSIFIED)).to.be.equal(true);
    for (let node of graph.nodes) {
      expect(nodeStatusContainer.isStatus(node.id, Scan.NODE_STATUS.UNCLASSIFIED)).to.be.equal(true);
    }
    expect(nodeStatusContainer.getNodes(Scan.NODE_STATUS.UNCLASSIFIED)).to.have.same.members(allNodeIds);
  });
});

describe('When node status is changed in NodeStatusContainer,', () => {
  before(() => {
    graph = createGraph(5);
    allNodeIds = graph.nodes.map(node => node.id);
  });
  it('should remove the node from the old status', () => {
    let nodeStatusContainer = new Scan.NodeStatusContainer(graph);
    let nodeId = graph.nodes[0].id;

    assert.isTrue(nodeStatusContainer.isStatus(nodeId, Scan.NODE_STATUS.UNCLASSIFIED));
    nodeStatusContainer.setStatus(nodeId, Scan.NODE_STATUS.NONMEMBER);
    expect(nodeStatusContainer.isStatus(nodeId, Scan.NODE_STATUS.NONMEMBER)).to.be.true;
  });
});

describe('When using GraphInfo,', () => {
  before(() => {
    graph = {
      nodes: [{
        id: 1
      },
      {
        id: 2
      },
      {
        id: 3
      },
      {
        id: 4
      }
      ],
      edges: [{
        id: 1,
        source: 1,
        target: 2
      },
      {
        id: 2,
        source: 1,
        target: 3
      },
      {
        id: 3,
        source: 2,
        target: 3
      }
      ]
    };

    graphInfo = new Scan.GraphInfo(graph, {
      useDirection: false
    });
  });
  it('should correctly find neighbours when using no direction', () => {
    let graphInfo = new Scan.GraphInfo(graph);

    expect([...graphInfo.getNeighbours(1)]).to.have.same.members([2, 3]);
    expect([...graphInfo.getNeighbours(2)]).to.have.same.members([1, 3]);
    expect([...graphInfo.getNeighbours(3)]).to.have.same.members([1, 2]);
    expect(graphInfo.getNeighbours(4)).to.be.empty;
  });
  it('should correctly find neighoburs when using direction', () => {
    let graphInfo = new Scan.GraphInfo(graph, {
      useDirection: true
    });

    expect([...graphInfo.getNeighbours(1)]).to.have.same.members([2, 3]);
    expect([...graphInfo.getNeighbours(2)]).to.have.same.members([3]);
    expect(graphInfo.getNeighbours(3)).to.be.empty;
    expect(graphInfo.getNeighbours(4)).to.be.empty;
  });
  it('should correctly find common neighoburs.', () => {
    expect([...graphInfo.getCommonNeighbours(1, 2)]).to.have.same.members([3]);
    expect(graphInfo.getCommonNeighbours(1, 4)).to.be.empty;
  });
  it('should get vertexStructure correctly.', () => {
    expect([...graphInfo.getVertexStructure(1)]).to.have.same.members([1, 2, 3]);
    expect([...graphInfo.getVertexStructure(4)]).to.have.same.members([4]);
  });
  it('should compute structurar similarity correctly', () => {
    expect(graphInfo.getStructuralSimilarity(1, 2)).to.be.closeTo(3.0 / Math.sqrt(3.0 * 3.0), 0.001);
    expect(graphInfo.getStructuralSimilarity(1, 4)).to.be.closeTo(0.0, 0.001);
  });
  it('should find epsilon neighbourhood correctly', () => {
    expect([...graphInfo.getEpsilonNeighbourhood(1, 1)]).to.have.same.members([1, 2, 3]);
    expect([...graphInfo.getEpsilonNeighbourhood(1, 0)]).to.have.same.members([1, 2, 3]);
    expect([...graphInfo.getEpsilonNeighbourhood(4, 0)]).to.have.same.members([4]);
  });
  it('should check core correctly', () => {
    expect(graphInfo.isCore(4, 1.0, 2)).to.be.false;
    expect(graphInfo.isCore(2, 1.0, 4)).to.be.false;
    expect(graphInfo.isCore(1, 1.0, 3)).to.be.true;
    expect(graphInfo.isCore(1, 1.0, 2)).to.be.true;
    expect(graphInfo.isCore(1, 1.0, 1)).to.be.true;
  });
});

describe('When using clustercontainer', () => {
  it('should be empty', () => {
    let clusterContainer = new Scan.ClusterContainer();

    expect(clusterContainer.getHubs()).to.be.empty;
    expect(clusterContainer.getOutliers()).to.be.empty;
  });
  it('should give correct cluster and node type after assigning', () => {
    let clusterContainer = new Scan.ClusterContainer();
    const HUB_ID = 1;
    const OUTLIER_ID = 2;
    const NODE_ID = 3;
    const clusterId = clusterContainer.addNewCluster();

    clusterContainer.addHub(HUB_ID);
    clusterContainer.addOutlier(OUTLIER_ID);
    clusterContainer.addToCluster(clusterId, NODE_ID);

    expect(clusterContainer.getHubs()).to.have.same.members([HUB_ID]);
    expect(clusterContainer.getOutliers()).to.have.same.members([OUTLIER_ID]);
    expect(clusterContainer.getCluster(NODE_ID)).to.be.equal(clusterId);
  });
});

describe('When using clustercontainer with graphinfo', () => {
  it('should correctly identify hub', () => {
    let clusterContainer = new Scan.ClusterContainer();
    const cluster1 = clusterContainer.addNewCluster();
    const cluster2 = clusterContainer.addNewCluster();

    clusterContainer.addToCluster(cluster1, 2);
    clusterContainer.addToCluster(cluster2, 3);

    expect(graphInfo.isHub(1, clusterContainer)).to.be.true;
  });
});

describe('When using original scan algorithm', () => {
  before(() => {
    graph = {
      nodes: [],
      edges: []
    };
    for (let i = 0; i < 14; ++i) {
      graph.nodes.push({
        id: i
      });
    };
    const addEdge = (graph, source, target) => {
      const nextEdgeId = graph.edges.length;

      graph.edges.push({
        id: nextEdgeId,
        source: source,
        target: target
      });
    };

    addEdge(graph, 0, 1);
    addEdge(graph, 0, 4);
    addEdge(graph, 0, 5);
    addEdge(graph, 0, 6);
    addEdge(graph, 1, 2);
    addEdge(graph, 1, 5);
    addEdge(graph, 2, 3);
    addEdge(graph, 2, 5);
    addEdge(graph, 3, 4);
    addEdge(graph, 3, 5);
    addEdge(graph, 3, 6);
    addEdge(graph, 4, 5);
    addEdge(graph, 4, 6);
    addEdge(graph, 6, 7);
    addEdge(graph, 6, 10);
    addEdge(graph, 6, 11);
    addEdge(graph, 7, 8);
    addEdge(graph, 7, 11);
    addEdge(graph, 7, 12);
    addEdge(graph, 8, 9);
    addEdge(graph, 8, 12);
    addEdge(graph, 9, 10);
    addEdge(graph, 9, 12);
    addEdge(graph, 9, 13);
    addEdge(graph, 10, 11);
    addEdge(graph, 10, 12);
  });
  it('should cluster the graph correctly', () => {
    let clusterResult = Scan.scanOriginal(graph, 0.67, 3);

    console.log(clusterResult);
  });
});
