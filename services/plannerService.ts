import { supabase } from '@/lib/supabase';
import { TripPlan, InterestTag } from '@/types';
import { calculateDistance } from '@/helpers/time.helper';

// Planlayıcı servisleri

export const plannerService = {
  // Tüm gezi planlarını getir
  getAllTripPlans: async (): Promise<TripPlan[]> => {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .select(`
          *,
          user:users(username, avatar),
          places:plan_places(
            place:places(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trip plans:', error);
        return [];
      }

      // Plan verilerini düzenle
      const formattedPlans = data.map(plan => {
        return {
          ...plan,
          username: plan.user?.username || 'Kullanıcı',
          avatar: plan.user?.avatar || '',
          places: plan.places?.map((pp: any) => pp.place) || []
        };
      });

      return formattedPlans;
    } catch (error) {
      console.error('Error in getAllTripPlans:', error);
      return [];
    }
  },

  // Kullanıcının gezi planlarını getir
  getUserTripPlans: async (userId: string): Promise<TripPlan[]> => {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .select(`
          *,
          places:plan_places(
            place:places(*)
          )
        `)
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user trip plans:', error);
        return [];
      }

      // Plan verilerini düzenle
      const formattedPlans = data.map(plan => {
        return {
          ...plan,
          places: plan.places?.map((pp: any) => pp.place) || []
        };
      });

      return formattedPlans;
    } catch (error) {
      console.error('Error in getUserTripPlans:', error);
      return [];
    }
  },

  // Plan detaylarını getir
  getTripPlanById: async (planId: string): Promise<TripPlan | null> => {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .select(`
          *,
          user:users(username, avatar),
          places:plan_places(
            place:places(*),
            order_index,
            status
          )
        `)
        .eq('id', planId)
        .single();

      if (error) {
        console.error('Error fetching trip plan:', error);
        return null;
      }

      // Plan verilerini düzenle
      const formattedPlan = {
        ...data,
        username: data.user?.username || 'Kullanıcı',
        avatar: data.user?.avatar || '',
        places: data.places
          ?.sort((a: any, b: any) => a.order_index - b.order_index)
          .map((pp: any) => ({
            ...pp.place,
            status: pp.status || 'not_visited' // Her yer için durum bilgisi
          })) || []
      };

      return formattedPlan;
    } catch (error) {
      console.error('Error in getTripPlanById:', error);
      return null;
    }
  },

  // Yeni gezi planı oluştur
  createTripPlan: async (planInfo: {
    title: string;
    description: string;
    category: string;
    budget: string;
    duration: string;
    image_url: string;
    created_by: string;
    place_ids: string[];
  }): Promise<TripPlan | null> => {
    try {
      // 1. Trip plan oluştur
      const { data: newPlan, error: planError } = await supabase
        .from('trip_plans')
        .insert({
          title: planInfo.title,
          description: planInfo.description,
          category: planInfo.category,
          budget: planInfo.budget,
          duration: planInfo.duration,
          image_url: planInfo.image_url,
          created_by: planInfo.created_by,
          is_public: true
        })
        .select()
        .single();

      if (planError) {
        console.error('Error creating trip plan:', planError);
        throw planError;
      }

      // 2. Plan yerlerini oluştur
      if (planInfo.place_ids && planInfo.place_ids.length > 0) {
        const planPlacesData = planInfo.place_ids.map((placeId: string, index: number) => ({
          plan_id: newPlan.id,
          place_id: placeId,
          order_index: index
        }));

        const { error: placesError } = await supabase
          .from('plan_places')
          .insert(planPlacesData);

        if (placesError) {
          console.error('Error adding places to plan:', placesError);
          // Hata durumunda oluşturulan planı silme işlemi yapılabilir
        }
      }

      // 3. Kategoriyi ilgi alanları tablosuna ekle
      if (planInfo.category) {
        // İlgi alanını getir veya oluştur
        let interestTagId: string | null = null;

        const { data: existingTag, error: tagError } = await supabase
          .from('interest_tags')
          .select('id')
          .eq('name', planInfo.category)
          .single();

        if (tagError && tagError.code !== 'PGRST116') {
          console.error('Error checking interest tag:', tagError);
        }

        if (existingTag) {
          interestTagId = existingTag.id;
        } else {
          // Yeni ilgi alanı oluştur
          const { data: newTag, error: newTagError } = await supabase
            .from('interest_tags')
            .insert({ name: planInfo.category })
            .select()
            .single();

          if (newTagError) {
            console.error('Error creating interest tag:', newTagError);
          } else {
            interestTagId = newTag.id;
          }
        }

        // Plan ile ilgi alanını ilişkilendir
        if (interestTagId) {
          const { error: interestError } = await supabase
            .from('plan_interests')
            .insert({
              plan_id: newPlan.id,
              interest_id: interestTagId
            });

          if (interestError) {
            console.error('Error linking interest to plan:', interestError);
          }
        }
      }

      return newPlan;
    } catch (error) {
      console.error('Error in createTripPlan:', error);
      throw error;
    }
  },

  // Gezi planını güncelle
  updateTripPlan: async (planId: string, planData: Partial<TripPlan>): Promise<TripPlan | null> => {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .update(planData)
        .eq('id', planId)
        .select()
        .single();

      if (error) {
        console.error('Error updating trip plan:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateTripPlan:', error);
      return null;
    }
  },

  // Gezi planını sil
  deleteTripPlan: async (planId: string): Promise<boolean> => {
    try {
      // Önce plan_places tablosundaki ilişkili yerler silinir
      const { error: placesError } = await supabase
        .from('plan_places')
        .delete()
        .eq('plan_id', planId);

      if (placesError) {
        console.error('Error deleting plan places:', placesError);
        return false;
      }

      // Sonra plan_interests tablosundaki ilişkili ilgi alanları silinir
      const { error: interestsError } = await supabase
        .from('plan_interests')
        .delete()
        .eq('plan_id', planId);

      if (interestsError) {
        console.error('Error deleting plan interests:', interestsError);
        return false;
      }

      // En son plan silinir
      const { error: planError } = await supabase
        .from('trip_plans')
        .delete()
        .eq('id', planId);

      if (planError) {
        console.error('Error deleting trip plan:', planError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteTripPlan:', error);
      return false;
    }
  },

  // İlgi alanlarını (interest tags) getir
  getInterestTags: async (): Promise<InterestTag[]> => {
    try {
      const { data, error } = await supabase
        .from('interest_tags')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching interest tags:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error in getInterestTags:', error);
      return [];
    }
  },

  // Plana yer ekle
  addPlaceToTripPlan: async (planId: string, placeId: string, orderIndex: number = 0): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('plan_places')
        .insert({
          plan_id: planId,
          place_id: placeId,
          order_index: orderIndex
        });

      if (error) {
        console.error('Error adding place to trip plan:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in addPlaceToTripPlan:', error);
      return false;
    }
  },

  // Plandan yer çıkar
  removePlaceFromTripPlan: async (planId: string, placeId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('plan_places')
        .delete()
        .eq('plan_id', planId)
        .eq('place_id', placeId);

      if (error) {
        console.error('Error removing place from trip plan:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in removePlaceFromTripPlan:', error);
      return false;
    }
  },

  // Gezi planı yerinin ziyaret durumunu güncelle
  updatePlaceVisitStatus: async (planId: string, placeId: string, status: 'visited' | 'not_visited'): Promise<boolean> => {
    try {
      // Plan yerinin durumunu güncelle
      const { error } = await supabase
        .from('plan_places')
        .update({ status })
        .eq('plan_id', planId)
        .eq('place_id', placeId);

      if (error) {
        console.error('Error updating place visit status:', error);
        return false;
      }

      // Plan durumunu güncelleyelim
      await plannerService.updateTripPlanStatus(planId);

      return true;
    } catch (error) {
      console.error('Error in updatePlaceVisitStatus:', error);
      return false;
    }
  },

  // Tüm yerlerin durumuna göre plan durumunu güncelle
  updateTripPlanStatus: async (planId: string): Promise<boolean> => {
    try {
      // Plan yerlerini getir
      const { data: places, error: placesError } = await supabase
        .from('plan_places')
        .select('status')
        .eq('plan_id', planId);

      if (placesError) {
        console.error('Error fetching plan places:', placesError);
        return false;
      }

      // Toplam ve ziyaret edilen yer sayılarını hesapla
      const totalPlaces = places.length;
      const visitedPlaces = places.filter(place => place.status === 'visited').length;

      let status: 'active' | 'completed' | 'cancelled' = 'active';

      // Eğer tüm yerler ziyaret edildiyse planı tamamlanmış olarak işaretle
      if (totalPlaces > 0 && visitedPlaces === totalPlaces) {
        status = 'completed';
      }

      // Plan durumunu güncelle
      const { error: updateError } = await supabase
        .from('trip_plans')
        .update({ status })
        .eq('id', planId);

      if (updateError) {
        console.error('Error updating trip plan status:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateTripPlanStatus:', error);
      return false;
    }
  },

  // Konum bazlı otomatik ziyaret durumu kontrolü
  checkLocationBasedVisit: async (planId: string, currentLocation: { latitude: number; longitude: number; }): Promise<boolean> => {
    try {
      // Önce plan yerlerini getirelim
      const { data: planPlaces, error: placesError } = await supabase
        .from('plan_places')
        .select('id, place_id, status')
        .eq('plan_id', planId);

      if (placesError || !planPlaces) {
        console.error('Error fetching plan places:', placesError);
        return false;
      }

      // Güncelleme yapıldı mı kontrolü
      let updatedAny = false;

      // Her yer için konum kontrolü yap
      for (const placeItem of planPlaces) {
        // Zaten ziyaret edilmişse atla
        if (placeItem.status === 'visited') continue;

        // Yer bilgilerini ve konumunu getir
        const { data: placeData, error: placeError } = await supabase
          .from('places')
          .select('id, name, location')
          .eq('id', placeItem.place_id)
          .single();

        if (placeError || !placeData || !placeData.location) {
          console.error(`Error fetching place data for ${placeItem.place_id}:`, placeError);
          continue;
        }

        // Mesafeyi hesapla
        const distance = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          placeData.location.latitude,
          placeData.location.longitude
        );

        // Eğer 200 metre içindeyse ziyaret edildi olarak işaretle
        if (distance <= 0.2) { // 0.2 km = 200 metre
          const { error: updateError } = await supabase
            .from('plan_places')
            .update({ status: 'visited' })
            .eq('id', placeItem.id);

          if (!updateError) {
            updatedAny = true;
          } else {
            console.error('Error updating place visit status:', updateError);
          }
        }
      }

      // Eğer herhangi bir güncelleme yapıldıysa plan durumunu da güncelle
      if (updatedAny) {
        await plannerService.updateTripPlanStatus(planId);
      }

      return updatedAny;
    } catch (error) {
      console.error('Error in checkLocationBasedVisit:', error);
      return false;
    }
  }
};
