import json
import random
import numpy as np
import pandas as pd
from flask import Flask,render_template
from sklearn import manifold
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import pairwise_distances
from sklearn.preprocessing import MinMaxScaler

county_file  = pd.read_csv('./data/County_accident.csv', low_memory=False)
state_file  = pd.read_csv('./data/State_accident.csv', low_memory=False)
report_file  = pd.read_csv('./data/accident.csv', low_memory=False)

loadingVector = {}
top5_data = {}              
random_samples = []
data = []
pca = []
mds = []
eigenValues = []
eigenVectors = []

columns = ['Bump', 'Crossing', 'Give_Way', 'Junction', 'No_Exit', 'Railway', 'Roundabout', 'Stop']
input_file = county_file.copy()    
minmaxscaler = MinMaxScaler()
input_file[columns]=minmaxscaler.fit_transform(input_file[columns])

def random_sample():
  #Random Sampling
    global random_samples
    global data

    features = input_file[columns]
    data = np.array(features)
    for j in range(1000):
        i = random.randint(0,len(data)-1)    
        random_samples.append(data[i])
    print("Random Sampling Completed")

def clustering():
    # Clustering the data
    global input_file
    features = input_file[columns]
    kmeans = KMeans(n_clusters=3)
    kmeans.fit(features)
    labels = kmeans.labels_
    input_file['kcluster'] = pd.Series(labels)


def eig_values(data):
    global eigenValues
    global eigenVectors

    matrix = data - np.mean(data, axis=0)
    cov = np.dot(matrix.T, matrix)
    eigenValues, eigenVectors = np.linalg.eig(cov)

    idx = eigenValues.argsort()[::-1]
    eigenValues = eigenValues[idx]
    eigenVectors = eigenVectors[:, idx]
    eigenValues = eigenValues * 1.5  
    print("Eigen Values Computed")


def plot_intrinsic_dimensionality_pca(data, k):
    # print("Inside plot_intrinsic_dimensionality_pca")
    global loadingVector
    global eigenValues
    global eigenVectors

    idx = eigenValues.argsort()[::-1]
    eigenValues = eigenValues[idx]
    eigenVectors = eigenVectors[:, idx]
    squaredLoadings = []
    ftrCount = len(eigenVectors)
    for ftrId in range(0,ftrCount):
        loadings = 0
        for compId in range(0, k):
            loadings = loadings + eigenVectors[compId][ftrId] * eigenVectors[compId][ftrId]
        loadingVector[columns[ftrId]] = loadings
        squaredLoadings.append(loadings)
    print("Squareloadings Computed")
    return squaredLoadings

random_sample()
clustering()
eig_values(data)
squared_loadings = plot_intrinsic_dimensionality_pca(data, 3)
selected_features = sorted(range(len(squared_loadings)), key=lambda k: squared_loadings[k], reverse=True)

def pca_analysis():
    # PCA reduction with random sampling
    global pca
    global data
    global selected_features
    pca_data = PCA(n_components=2)
    X = data
    pca_data.fit(X)
    X = pca_data.transform(X)
    pca = pd.DataFrame(X)

    for i in range(0, 2):
        pca[columns[selected_features[i]]] = input_file[columns[selected_features[i]]]

    pca['clusterid'] = input_file['kcluster']
    print("PCA Completed")

def mds_analysis():
    # MDS reduction with random sampling and using Euclidean
    global mds
    global random_samples
    global selected_features
    mds_data = manifold.MDS(n_components=2, dissimilarity='precomputed')
    similarity = pairwise_distances(random_samples, metric='correlation')
    
    X = mds_data.fit_transform(similarity)
    mds = pd.DataFrame(X)

    for i in range(0, 2):
        mds[columns[selected_features[i]]] = input_file[columns[selected_features[i]]]

    mds['clusterid'] = input_file['kcluster']
    print("MDS using Correlation Completed")

def county_5():
    global report_file
    global top5_data
    top_county = report_file.copy()
    top_county = top_county.groupby(by=["State",'County']).sum().reset_index()
    del(top_county['Year'])
    top_county = top_county.sort_values(by=['State','Accidents'],ascending=False).reset_index(drop=True)
    top_county = top_county.to_dict(orient='records')

    for row in top_county:
        if row['State'] not in top5_data:
            top5_data[row['State']] = [row['County']+':'+str(row['Accidents'])]
        elif row['State'] in top5_data:
            if len(top5_data[row['State']])<5:
                top5_data[row['State']].append(row['County']+':'+str(row['Accidents']))
    print("Top 5 County Computed")

pca_analysis()
mds_analysis()
county_5()

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("dashboard.html")

@app.route("/get_squareloadings")
def getSquareLoadings():
    global loadingVector
    return json.dumps(loadingVector)

@app.route("/get_eigen_values")
def get_eigen_values():
    # print("Inside get_eigen_values")
    global eigenValues
    return json.dumps(eigenValues.tolist())

@app.route("/pca_analysis")
def get_pca_data():
    global pca
    return pca.to_json()
    
@app.route("/mds_analysis")
def get_mds_data():
    global mds
    return mds.to_json()

@app.route("/accident_state")
def accident_state():
    global state_file
    state_data = state_file.copy()
    state_data = state_data.to_dict(orient='records')
    json_accident_state = json.dumps(state_data)
    print("State Data Loaded")
    return json_accident_state

@app.route("/top_county")
def statewise_county():
    global report_file
    global top5_data
    print("Top 5 County Data Loaded")
    return (json.dumps(top5_data))

@app.route("/accident_report")
def accident_report():
    global report_file
    report_data = report_file.copy()
    report_data = report_data.to_dict(orient='records')
    accident_report = json.dumps(report_data)
    print("Accident Report Loaded")
    return accident_report

@app.route("/us_states_json")
def us_states_json():
    with open('us.json') as data_file:
        data = json.load(data_file)    
    data = json.dumps(data)
    return data

if __name__ == "__main__":
    app.run('localhost', '5050')