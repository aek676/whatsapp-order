import { Database } from "@/lib/database.types"

declare global {
    type EstablishmentWithUser = Database['public']['Tables']['establishment_users']['Row'] & {
        establishments: Database['public']['Tables']['establishments']['Row'] | null
    }

    type ScheduleWithEstablishment = Database['public']['Tables']['days']['Row'] & {
        session_schedule: Database['public']['Tables']['session_schedule']['Row'][]
    }

    type Products = Database['public']['Tables']['products']['Row'];

    type MenusWithProducts = Database['public']['Tables']['menus']['Row'] & {
        menu_product: Array<
            Database['public']['Tables']['menu_product']['Row'] & {
                products: Database['public']['Tables']['products']['Row']
            }
        >;
    };

    type OrderWithDetails = Database['public']['Tables']['orders']['Row'] & {
        chats: Database['public']['Tables']['chats']['Row'];
        details_order: Array<
            Database['public']['Tables']['details_order']['Row'] & {
                products?: Database['public']['Tables']['products']['Row'] | null;
                menus?: Database['public']['Tables']['menus']['Row'] | null;
            }
        >;
    };

    type EstablishmentData = Database['public']['Tables']['establishments']['Row'];
    type ScheduleData = Database['public']['Tables']['days']['Row'] & {
        session_schedule: Database['public']['Tables']['session_schedule']['Row'][]
    }
    type ProductData = Database['public']['Tables']['products']['Row'];
    type MenusData = Database['public']['Tables']['menus']['Row'] & {
        menu_product: Database['public']['Tables']['menu_product']['Row'][]
    };
    type OrderData = Database['public']['Tables']['orders']['Insert'];
    type DetailsOrder = Database['public']['Tables']['details_order']['Insert'];
    type RoleDB = 'user' | 'assistant' | 'function';
    type MessageData = Database['public']['Tables']['messages']['Row'];
    type MessageInsert = Database['public']['Tables']['messages']['Insert'];
    type ChatInsert = Database['public']['Tables']['chats']['Insert'];
    type ChatData = Database['public']['Tables']['chats']['Row'];
}