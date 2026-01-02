import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import api from '../services/api';

interface Station {
  id: string;
  name: string;
}

interface StationManager {
  id: string;
  name: string;
  employeeId: string;
  station?: Station;
}

interface AreaManager {
  id: string;
  name: string;
  employeeId: string;
  stationManagers?: StationManager[];
}

export const Dashboard = () => {
  const { user, isSM, isAM, isAdmin } = useAuth();
  const [areaManagers, setAreaManagers] = useState<AreaManager[]>([]);
  const [stationManagers, setStationManagers] = useState<StationManager[]>([]);
  const [areaManager, setAreaManager] = useState<AreaManager | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const usersRes = await api.get('/api/users');
      const allUsers = usersRes.data.users;

      if (isAdmin) {
        // Load all area managers with their station managers
        const ams = allUsers.filter((u: any) => u.role === 'AM');
        const sms = allUsers.filter((u: any) => u.role === 'SM');

        // Get stations
        const stationsRes = await api.get('/api/stations');
        const stations = stationsRes.data.stations;

        // Map station managers to their stations
        const smsWithStations = sms.map((sm: any) => ({
          ...sm,
          station: stations.find((s: any) => s.id === sm.stationId)
        }));

        // Group station managers under their area managers
        const amsWithSMs = ams.map((am: any) => ({
          ...am,
          stationManagers: smsWithStations.filter((sm: any) => sm.areaManagerId === am.id)
        }));

        setAreaManagers(amsWithSMs);
      } else if (isAM) {
        // Load station managers under this area manager
        const sms = allUsers.filter((u: any) => u.role === 'SM' && u.areaManagerId === user?.id);

        // Get stations
        const stationsRes = await api.get('/api/stations');
        const stations = stationsRes.data.stations;

        const smsWithStations = sms.map((sm: any) => ({
          ...sm,
          station: stations.find((s: any) => s.id === sm.stationId)
        }));

        setStationManagers(smsWithStations);
      } else if (isSM) {
        // Load area manager and station info
        if (user?.areaManagerId) {
          const am = allUsers.find((u: any) => u.id === user.areaManagerId);
          setAreaManager(am);
        }

        if (user?.stationId) {
          const stationsRes = await api.get('/api/stations');
          const st = stationsRes.data.stations.find((s: any) => s.id === user.stationId);
          setStation(st);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome, {user?.name}!</h1>
        <p className="text-gray-600 mb-6">
          You are logged in as <span className="font-semibold">{user?.role}</span>
        </p>

        {/* Admin: Organizational Chart */}
        {isAdmin && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 mb-6">
            <h3 className="text-2xl font-bold text-purple-900 mb-6 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Organization Structure
            </h3>

            {loading ? (
              <p className="text-purple-700">Loading...</p>
            ) : areaManagers.length > 0 ? (
              <div className="space-y-6">
                {areaManagers.map((am) => (
                  <div key={am.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* Area Manager Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
                      <div className="flex items-center text-white">
                        <div className="bg-white bg-opacity-20 rounded-full p-3 mr-4">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium opacity-90">Area Manager</p>
                          <p className="text-xl font-bold">{am.name}</p>
                          <p className="text-sm opacity-75">ID: {am.employeeId}</p>
                        </div>
                      </div>
                    </div>

                    {/* Station Managers under this AM */}
                    <div className="p-4">
                      {am.stationManagers && am.stationManagers.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {am.stationManagers.map((sm) => (
                            <div key={sm.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
                              <div className="flex items-start">
                                <div className="bg-green-100 rounded-full p-2 mr-3">
                                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-gray-500 font-medium">Station Manager</p>
                                  <p className="font-semibold text-gray-900">{sm.name}</p>
                                  <p className="text-xs text-gray-600">ID: {sm.employeeId}</p>
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div className="flex items-center text-sm">
                                      <svg className="w-4 h-4 text-orange-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                      </svg>
                                      <span className="text-gray-700 font-medium">
                                        {sm.station ? sm.station.name : <span className="text-red-600">Not Assigned</span>}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-4">No station managers assigned to this area manager</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-purple-700">No area managers found. Create area managers in the Employees page.</p>
            )}
          </div>
        )}

        {/* SM: Assignment Info */}
        {isSM && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Your Assignment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-blue-700 font-medium">Assigned Station:</p>
                <p className="text-blue-900 text-lg">
                  {station ? station.name : <span className="text-red-600">Not Assigned</span>}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Reports To (Area Manager):</p>
                <p className="text-blue-900 text-lg">
                  {areaManager ? `${areaManager.name} (${areaManager.employeeId})` : <span className="text-red-600">Not Assigned</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AM: Station Managers */}
        {isAM && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-green-900 mb-3">Station Managers Under You</h3>
            {loading ? (
              <p className="text-green-700">Loading...</p>
            ) : stationManagers.length > 0 ? (
              <div className="space-y-2">
                {stationManagers.map((sm) => (
                  <div key={sm.id} className="bg-white rounded p-3 border border-green-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-green-900">{sm.name}</p>
                        <p className="text-sm text-green-700">Employee ID: {sm.employeeId}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-green-700">Station:</p>
                        <p className="font-medium text-green-900">
                          {sm.station?.name || <span className="text-red-600">Not Assigned</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-green-700">No station managers assigned to you yet.</p>
            )}
          </div>
        )}

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-primary-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-primary-900 mb-2">Cash Flow Module</h2>
            <p className="text-primary-700 mb-4">
              Track revenue and cash movement from station to bank
            </p>
            <Link
              to="/cash-flow"
              className="text-primary-600 hover:text-primary-800 font-medium inline-flex items-center"
            >
              Go to Cash Flow
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="bg-primary-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-primary-900 mb-2">Inventory Module</h2>
            <p className="text-primary-700 mb-4">
              Track fuel levels in tanks and nozzle meter readings
            </p>
            <Link
              to="/inventory"
              className="text-primary-600 hover:text-primary-800 font-medium inline-flex items-center"
            >
              Go to Inventory
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
