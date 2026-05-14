import React from 'react';
import { Package, MapPin, Calendar, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

const PickupCard = ({ 
  pickup, 
  userRole, 
  onAccept, 
  onConfirm, 
  weightInput, 
  setWeightInput, 
  isUpdating 
}) => {
  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed': return 'text-emerald-700 bg-emerald-100 border-emerald-200';
      case 'accepted': return 'text-blue-700 bg-blue-100 border-blue-200';
      default: return 'text-amber-700 bg-amber-100 border-amber-200';
    }
  };

  const getStatusIcon = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 mr-1" />;
      case 'accepted': return <Clock className="w-4 h-4 mr-1" />;
      default: return <AlertCircle className="w-4 h-4 mr-1" />;
    }
  };

  return (
    <div className="bg-white border border-green-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-800 capitalize">{pickup.wasteType || pickup.type}</h3>
          </div>
          {(userRole === 'collector' || userRole === 'recycling collector') && pickup.societyName && (
            <p className="text-sm font-semibold text-gray-600 mt-1">{pickup.societyName}</p>
          )}
        </div>
        <span className={`flex items-center px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusColor(pickup.status)}`}>
          {getStatusIcon(pickup.status)}
          {pickup.status || 'Pending'}
        </span>
      </div>

      <div className="space-y-2 mb-6 text-sm text-gray-600">
        {(pickup.location || pickup.area) && (
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-gray-400" />
            <span className="font-medium">{pickup.location || pickup.area}</span>
          </div>
        )}
        <div className="flex items-center">
          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
          <span className="font-medium">{new Date(pickup.date || pickup.createdAt || Date.now()).toLocaleDateString()}</span>
        </div>
        {pickup.weight && (
          <div className="font-bold text-gray-800 mt-2 bg-gray-50 py-1 px-2 rounded inline-block">
            Weight: {pickup.weight} kg
          </div>
        )}
        {pickup.creditsAwarded && (
          <div className="font-bold text-green-700 mt-1 bg-green-50 py-1 px-2 rounded inline-block">
            +{pickup.creditsAwarded} Credits
          </div>
        )}
      </div>

      {(userRole === 'collector' || userRole === 'recycling collector') && pickup.status !== 'completed' && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          {(pickup.status === 'pending' || pickup.status === 'requested') && (
            <button 
              onClick={() => onAccept(pickup.id || pickup._id)}
              disabled={isUpdating}
              className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Accept Pickup'}
            </button>
          )}
          
          {(pickup.status === 'accepted' || pickup.status === 'in-progress') && (
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input 
                  type="number"
                  placeholder="Weight (kg)"
                  value={weightInput || ''}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>
              <button 
                onClick={() => onConfirm(pickup.id || pickup._id)}
                disabled={isUpdating || !weightInput}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {isUpdating ? 'Confirming...' : 'Confirm Pickup & Award Credits'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PickupCard;
